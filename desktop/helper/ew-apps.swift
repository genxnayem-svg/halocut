// ew-apps: macOS helper for HaloCut's Orbit switch.
// Lists open apps (most recently used first) with their windows, hands out app icons,
// and brings an app or one of its windows to the front.
//
// stdin  (JSON lines): {"id":1,"cmd":"list"}  {"id":2,"cmd":"icon","path":"/Applications/X.app"}
//                      {"id":3,"cmd":"activate","pid":123}  {"id":4,"cmd":"raise","pid":123,"index":0}
//                      {"id":5,"cmd":"installed"}  {"id":6,"cmd":"launch","path":"/Applications/X.app"}
// stdout (JSON lines): {"id":1,"apps":[{"pid":..,"name":..,"bundleId":..,"path":..,"front":B,"windows":[{"title":..,"minimized":B}]}]}
//                      {"id":2,"png":"<base64>"}  {"id":3,"ok":true}
import Cocoa
import ApplicationServices

let selfPid = ProcessInfo.processInfo.processIdentifier
let skipBundles: Set<String> = ["com.samistudio.halocut", "com.imtayznayem.halocut", "com.github.Electron"]
var windowCache: [pid_t: [AXUIElement]] = [:]

func reply(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj),
        let line = String(data: data, encoding: .utf8) else { return }
  FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

func attr<T>(_ el: AXUIElement, _ name: String) -> T? {
  var value: CFTypeRef?
  guard AXUIElementCopyAttributeValue(el, name as CFString, &value) == .success else { return nil }
  return value as? T
}

// Standard windows of an app, in the app's own front-to-back order.
func windows(of pid: pid_t) -> [AXUIElement] {
  let app = AXUIElementCreateApplication(pid)
  let all: [AXUIElement] = attr(app, kAXWindowsAttribute) ?? []
  return all.filter { w in
    let sub: String? = attr(w, kAXSubroleAttribute)
    return sub == nil || sub == (kAXStandardWindowSubrole as String)
  }
}

// Apps in the order their windows are stacked on screen: close to "most recently used".
func zOrder() -> [pid_t] {
  let opts: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
  guard let info = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else { return [] }
  var seen: [pid_t] = []
  for w in info {
    guard (w[kCGWindowLayer as String] as? Int) == 0, let pid = w[kCGWindowOwnerPID as String] as? pid_t else { continue }
    if !seen.contains(pid) { seen.append(pid) }
  }
  return seen
}

func list() -> [[String: Any]] {
  let running = NSWorkspace.shared.runningApplications.filter {
    $0.activationPolicy == .regular && !$0.isTerminated && $0.processIdentifier != selfPid
      && !skipBundles.contains($0.bundleIdentifier ?? "")
  }
  let order = zOrder()
  let rank: (NSRunningApplication) -> Int = { app in order.firstIndex(of: app.processIdentifier) ?? Int.max }
  let sorted = running.sorted { rank($0) == rank($1) ? ($0.localizedName ?? "") < ($1.localizedName ?? "") : rank($0) < rank($1) }
  windowCache = [:]
  return sorted.map { app in
    let pid = app.processIdentifier
    let ws = windows(of: pid)
    windowCache[pid] = ws
    return [
      "pid": pid,
      "name": app.localizedName ?? "App",
      "bundleId": app.bundleIdentifier ?? "",
      "path": app.bundleURL?.path ?? "",
      "front": app.isActive,
      "hidden": app.isHidden,
      "windows": ws.map { w -> [String: Any] in
        let title: String = attr(w, kAXTitleAttribute) ?? ""
        let minimized: Bool = attr(w, kAXMinimizedAttribute) ?? false
        return ["title": title, "minimized": minimized]
      },
    ]
  }
}

func icon(_ path: String, _ size: Int) -> String? {
  let img = NSWorkspace.shared.icon(forFile: path)
  let px = NSSize(width: size, height: size)
  guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                                   samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                   bytesPerRow: 0, bitsPerPixel: 0) else { return nil }
  rep.size = px
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  img.draw(in: NSRect(origin: .zero, size: px))
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])?.base64EncodedString()
}

// Apps installed in the usual places (and one folder down, like "Adobe Premiere Pro 2026/"), for pinning on the wheel.
func installed() -> [[String: Any]] {
  let fm = FileManager.default
  let dirs = ["/Applications", "/System/Applications", "/System/Applications/Utilities", NSHomeDirectory() + "/Applications"]
  var seen = Set<String>(), out: [[String: Any]] = []
  func add(_ path: String) {
    guard let b = Bundle(path: path), let id = b.bundleIdentifier, !seen.contains(id), !skipBundles.contains(id) else { return }
    seen.insert(id)
    var name = fm.displayName(atPath: path)
    if name.hasSuffix(".app") { name = String(name.dropLast(4)) }
    out.append(["name": name, "bundleId": id, "path": path])
  }
  for d in dirs {
    guard let items = try? fm.contentsOfDirectory(atPath: d) else { continue }
    for item in items where !item.hasPrefix(".") {
      let p = d + "/" + item
      if item.hasSuffix(".app") { add(p); continue }
      guard let sub = try? fm.contentsOfDirectory(atPath: p) else { continue }
      for s in sub where s.hasSuffix(".app") { add(p + "/" + s) }
    }
  }
  add("/System/Library/CoreServices/Finder.app")
  return out.sorted { ($0["name"] as? String ?? "").localizedCaseInsensitiveCompare($1["name"] as? String ?? "") == .orderedAscending }
}

func bringToFront(_ pid: pid_t) {
  guard let app = NSRunningApplication(processIdentifier: pid) else { return }
  if app.isHidden { app.unhide() }
  app.activate(options: [.activateAllWindows])
  AXUIElementSetAttributeValue(AXUIElementCreateApplication(pid), kAXFrontmostAttribute as CFString, kCFBooleanTrue)
}

func raise(_ pid: pid_t, _ index: Int) -> Bool {
  let ws = windowCache[pid] ?? windows(of: pid)
  guard index >= 0 && index < ws.count else { bringToFront(pid); return false }
  let w = ws[index]
  AXUIElementSetAttributeValue(w, kAXMinimizedAttribute as CFString, kCFBooleanFalse)
  AXUIElementPerformAction(w, kAXRaiseAction as CFString)
  AXUIElementSetAttributeValue(w, kAXMainAttribute as CFString, kCFBooleanTrue)
  bringToFront(pid)
  return true
}

func handle(_ line: String) {
  guard let data = line.data(using: .utf8),
        let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let cmd = obj["cmd"] as? String else { return }
  let id = obj["id"] ?? 0
  let pid = (obj["pid"] as? NSNumber).map { pid_t($0.int32Value) } ?? 0
  switch cmd {
  case "list": reply(["id": id, "apps": list(), "trusted": AXIsProcessTrusted()])
  case "icon":
    let path = obj["path"] as? String ?? ""
    let size = (obj["size"] as? NSNumber)?.intValue ?? 64
    reply(["id": id, "png": icon(path, size) ?? ""])
  case "activate": bringToFront(pid); reply(["id": id, "ok": true])
  case "raise": reply(["id": id, "ok": raise(pid, (obj["index"] as? NSNumber)?.intValue ?? 0)])
  case "installed": reply(["id": id, "apps": installed()])
  case "launch":
    // a pinned app that isn't open yet
    let conf = NSWorkspace.OpenConfiguration()
    conf.activates = true
    NSWorkspace.shared.openApplication(at: URL(fileURLWithPath: obj["path"] as? String ?? ""), configuration: conf) { _, err in
      DispatchQueue.main.async { reply(["id": id, "ok": err == nil]) }
    }
  default: reply(["id": id, "error": "unknown command \(cmd)"])
  }
}

Thread.detachNewThread {
  while let line = readLine() {
    DispatchQueue.main.async { handle(line) }
  }
  exit(0)
}

NSApplication.shared.setActivationPolicy(.prohibited)
RunLoop.main.run()
