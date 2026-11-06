// ew-input: macOS input helper for HaloCut.
// Watches mouse buttons and keys with a CGEventTap, and can swallow the ones HaloCut uses
// (the wheel trigger, mapped buttons) so the app underneath never sees them.
//
// stdin  (JSON lines): {"cmd":"rules","rules":[{"kind":"mouse","code":1,"mods":["ctrl"],"delayMs":200}, ...]}
//                      {"cmd":"record"}  {"cmd":"cancelRecord"}
// stdout (JSON lines): {"e":"ready"} {"e":"down"|"up","kind":"mouse"|"key","code":N,"mods":[...],"blocked":B,"repeat":B}
//                      {"e":"move"} {"e":"recorded","kind":...,"code":N,"mods":[...]} {"e":"recordCancelled"} {"e":"error","msg":...}
import Foundation
import CoreGraphics
import ApplicationServices

let REPLAY_TAG: Int64 = 0x4557_0001 // marks events we post ourselves

struct Rule {
  let kind: String
  let code: Int64
  let mods: Set<String>
  let delayMs: Double
}

var rules: [Rule] = []
var recording = false
var swallowing: [String: Double] = [:]         // "m1" / "k109" -> delay of the rule that swallowed it
var pendingDown: [String: (Double, CGEvent)] = [:] // delayed mouse triggers: time pressed, copy of the down event
var lastMove = 0.0
var tapPort: CFMachPort?

func now() -> Double { Date().timeIntervalSince1970 * 1000 }

func emit(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj),
        let line = String(data: data, encoding: .utf8) else { return }
  FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

func mods(_ f: CGEventFlags) -> [String] {
  var m: [String] = []
  if f.contains(.maskCommand) { m.append("cmd") }
  if f.contains(.maskControl) { m.append("ctrl") }
  if f.contains(.maskAlternate) { m.append("alt") }
  if f.contains(.maskShift) { m.append("shift") }
  return m
}

func match(_ kind: String, _ code: Int64, _ m: [String]) -> Rule? {
  let ms = Set(m)
  return rules.first { $0.kind == kind && $0.code == code && $0.mods == ms }
}

func replay(_ down: CGEvent, _ up: CGEvent) {
  for e in [down, up] {
    e.setIntegerValueField(.eventSourceUserData, value: REPLAY_TAG)
    e.post(tap: .cghidEventTap)
  }
}

func handle(_ type: CGEventType, _ event: CGEvent) -> Bool { // true = swallow
  if event.getIntegerValueField(.eventSourceUserData) == REPLAY_TAG { return false }

  switch type {
  case .mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged:
    let t = now()
    if t - lastMove > 8 { lastMove = t; emit(["e": "move"]) }
    if type != .leftMouseDragged {
      let b = event.getIntegerValueField(.mouseEventButtonNumber)
      return swallowing["m\(b)"] != nil
    }
    return false

  case .leftMouseDown, .rightMouseDown, .otherMouseDown:
    let b = event.getIntegerValueField(.mouseEventButtonNumber)
    let m = mods(event.flags)
    if recording && (b != 0 || !m.isEmpty) {
      recording = false
      swallowing["m\(b)"] = 0
      emit(["e": "recorded", "kind": "mouse", "code": b, "mods": m])
      return true
    }
    if let r = match("mouse", b, m) {
      swallowing["m\(b)"] = r.delayMs
      if r.delayMs > 0, let copy = event.copy() { pendingDown["m\(b)"] = (now(), copy) }
      emit(["e": "down", "kind": "mouse", "code": b, "mods": m, "blocked": true])
      return true
    }
    emit(["e": "down", "kind": "mouse", "code": b, "mods": m, "blocked": false])
    return false

  case .leftMouseUp, .rightMouseUp, .otherMouseUp:
    let b = event.getIntegerValueField(.mouseEventButtonNumber)
    let key = "m\(b)"
    let delay = swallowing.removeValue(forKey: key)
    let pending = pendingDown.removeValue(forKey: key)
    emit(["e": "up", "kind": "mouse", "code": b, "blocked": delay != nil])
    guard let d = delay else { return false }
    // A quick tap on a delayed trigger is an ordinary click: give it back to the app.
    if let (t0, down) = pending, now() - t0 < d, let up = event.copy() { replay(down, up) }
    return true

  case .keyDown:
    let code = event.getIntegerValueField(.keyboardEventKeycode)
    let rep = event.getIntegerValueField(.keyboardEventAutorepeat) != 0
    let m = mods(event.flags)
    if recording && !rep {
      recording = false
      if code == 53 { emit(["e": "recordCancelled"]); return true } // Escape
      swallowing["k\(code)"] = 0
      emit(["e": "recorded", "kind": "key", "code": code, "mods": m])
      return true
    }
    let held = swallowing["k\(code)"] != nil
    let r = held ? nil : match("key", code, m)
    if r != nil { swallowing["k\(code)"] = 0 }
    emit(["e": "down", "kind": "key", "code": code, "mods": m, "repeat": rep, "blocked": held || r != nil])
    return held || r != nil

  case .keyUp:
    let code = event.getIntegerValueField(.keyboardEventKeycode)
    let was = swallowing.removeValue(forKey: "k\(code)") != nil
    emit(["e": "up", "kind": "key", "code": code, "blocked": was])
    return was

  default:
    return false
  }
}

let callback: CGEventTapCallBack = { _, type, event, _ in
  if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
    if let p = tapPort { CGEvent.tapEnable(tap: p, enable: true) }
    return Unmanaged.passUnretained(event)
  }
  return handle(type, event) ? nil : Unmanaged.passUnretained(event)
}

// ---- commands from HaloCut ------------------------------------------------

func command(_ line: String) {
  guard let data = line.data(using: .utf8),
        let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let cmd = obj["cmd"] as? String else { return }
  switch cmd {
  case "rules":
    let list = obj["rules"] as? [[String: Any]] ?? []
    rules = list.compactMap { r in
      guard let kind = r["kind"] as? String, let code = (r["code"] as? NSNumber)?.int64Value else { return nil }
      return Rule(kind: kind, code: code, mods: Set(r["mods"] as? [String] ?? []),
                  delayMs: (r["delayMs"] as? NSNumber)?.doubleValue ?? 0)
    }
  case "record": recording = true
  case "cancelRecord": recording = false
  default: break
  }
}

Thread.detachNewThread {
  while let line = readLine() {
    DispatchQueue.main.async { command(line) }
  }
  exit(0) // HaloCut went away
}

// ---- start ---------------------------------------------------------------------

let types: [CGEventType] = [
  .keyDown, .keyUp, .leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp,
  .otherMouseDown, .otherMouseUp, .mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged,
]
let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }

guard let port = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap,
                                   options: .defaultTap, eventsOfInterest: mask,
                                   callback: callback, userInfo: nil) else {
  emit(["e": "error", "msg": AXIsProcessTrusted()
    ? "Input Monitoring is off for HaloCut"
    : "Accessibility is off for HaloCut"])
  exit(2)
}
tapPort = port
let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, port, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
CGEvent.tapEnable(tap: port, enable: true)
emit(["e": "ready"])
CFRunLoopRun()
