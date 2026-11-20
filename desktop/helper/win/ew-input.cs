// ew-input: Windows input helper for HaloCut. The same job and the same messages as the macOS helper (ew-input.swift).
// Watches mouse buttons and keys with low-level hooks, and can swallow the ones HaloCut uses
// (the wheel trigger, mapped buttons) so the app underneath never sees them. It also says which app is in front.
//
// stdin  (JSON lines): {"cmd":"rules","rules":[{"kind":"mouse","code":1,"mods":["ctrl"],"delayMs":200}, ...]}
//                      {"cmd":"scroll","on":true}  {"cmd":"record"}  {"cmd":"cancelRecord"}
// stdout (JSON lines): {"e":"ready"} {"e":"down"|"up","kind":"mouse"|"key","code":N,"mods":[...],"blocked":B,"repeat":B}
//                      {"e":"move"} {"e":"scroll","dy":N} {"e":"recorded","kind":...,"code":N,"mods":[...]}
//                      {"e":"recordCancelled"} {"e":"error","msg":...} {"e":"front","name":...,"id":"photoshop.exe","path":...}
// code: mouse 0 left, 1 right, 2 middle, 3 back, 4 forward · key: the Windows virtual-key code.
//
// Plain C# 5, so the compiler that ships with Windows builds it (see src/win-helper.js):
//   csc /target:exe /r:System.Web.Extensions.dll ew-input.cs
// © 2026 Imtayz Nayem
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

static class EwInput
{
  const int WH_KEYBOARD_LL = 13, WH_MOUSE_LL = 14;
  const int WM_KEYDOWN = 0x100, WM_SYSKEYDOWN = 0x104;
  const int WM_MOUSEMOVE = 0x200, WM_LBUTTONDOWN = 0x201, WM_LBUTTONUP = 0x202, WM_RBUTTONDOWN = 0x204, WM_RBUTTONUP = 0x205,
    WM_MBUTTONDOWN = 0x207, WM_MBUTTONUP = 0x208, WM_MOUSEWHEEL = 0x20A, WM_XBUTTONDOWN = 0x20B, WM_XBUTTONUP = 0x20C;
  static readonly UIntPtr TAG = (UIntPtr)0x45570001u; // marks events we post ourselves

  [StructLayout(LayoutKind.Sequential)] struct POINT { public int x, y; }
  [StructLayout(LayoutKind.Sequential)] struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData, flags, time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct KBDLLHOOKSTRUCT { public uint vkCode, scanCode, flags, time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public MOUSEINPUT mi; }
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }

  delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint min, uint max);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vKey);
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder name, ref uint size);

  class Rule { public string kind; public int code; public int mods; public double delayMs; }

  static readonly object gate = new object();     // rules and state: the hooks and the stdin reader share them
  static readonly object outGate = new object();
  static List<Rule> rules = new List<Rule>();
  static bool recording = false, scrollOn = false;
  static readonly Dictionary<string, double> swallowing = new Dictionary<string, double>(); // "m1" / "k121" -> delay of its rule
  static readonly Dictionary<string, double> pendingDown = new Dictionary<string, double>(); // delayed mouse triggers: time pressed
  static readonly HashSet<int> downKeys = new HashSet<int>();
  static double lastMove = 0;
  static TextWriter stdout;
  static HookProc mouseProc, keyProc; // kept so the hooks outlive garbage collection
  static Timer frontTimer;
  static string frontKey = null;

  static double Now() { return (double)Stopwatch.GetTimestamp() * 1000.0 / Stopwatch.Frequency; }

  static string Esc(string s)
  {
    StringBuilder b = new StringBuilder();
    foreach (char c in s ?? "")
    {
      if (c == '"' || c == '\\') { b.Append('\\').Append(c); }
      else if (c < 0x20) { b.Append("\\u").Append(((int)c).ToString("x4")); }
      else { b.Append(c); }
    }
    return b.ToString();
  }

  static void Emit(string json)
  {
    lock (outGate) { try { stdout.WriteLine(json); } catch { /* HaloCut went away */ } }
  }

  static bool Held(int vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }

  // ctrl 1 · alt 2 · shift 4 · cmd (the Windows key) 8
  static int Mods()
  {
    int m = 0;
    if (Held(0x11)) m |= 1;
    if (Held(0x12)) m |= 2;
    if (Held(0x10)) m |= 4;
    if (Held(0x5B) || Held(0x5C)) m |= 8;
    return m;
  }

  static string ModsJson(int m)
  {
    List<string> l = new List<string>();
    if ((m & 1) != 0) l.Add("\"ctrl\"");
    if ((m & 2) != 0) l.Add("\"alt\"");
    if ((m & 4) != 0) l.Add("\"shift\"");
    if ((m & 8) != 0) l.Add("\"cmd\"");
    return "[" + string.Join(",", l.ToArray()) + "]";
  }

  static bool IsModifier(int vk) { return vk == 0x10 || vk == 0x11 || vk == 0x12 || (vk >= 0xA0 && vk <= 0xA5) || vk == 0x5B || vk == 0x5C; }

  static Rule Match(string kind, int code, int m)
  {
    foreach (Rule r in rules) { if (r.kind == kind && r.code == code && r.mods == m) return r; }
    return null;
  }

  static string B(bool v) { return v ? "true" : "false"; }

  // A quick tap on a delayed trigger is an ordinary click: give it back to the app.
  static void Replay(int b)
  {
    ThreadPool.QueueUserWorkItem(delegate
    {
      uint down, up, data = 0;
      if (b == 0) { down = 0x0002; up = 0x0004; }
      else if (b == 1) { down = 0x0008; up = 0x0010; }
      else if (b == 2) { down = 0x0020; up = 0x0040; }
      else { down = 0x0080; up = 0x0100; data = (uint)(b == 3 ? 1 : 2); }
      INPUT[] inputs = new INPUT[2];
      inputs[0].type = 0; inputs[0].mi.dwFlags = down; inputs[0].mi.mouseData = data; inputs[0].mi.dwExtraInfo = TAG;
      inputs[1].type = 0; inputs[1].mi.dwFlags = up; inputs[1].mi.mouseData = data; inputs[1].mi.dwExtraInfo = TAG;
      SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    });
  }

  static bool Mouse(int msg, MSLLHOOKSTRUCT s) // true = swallow
  {
    if (s.dwExtraInfo == TAG) return false;

    if (msg == WM_MOUSEMOVE)
    {
      double t = Now();
      if (t - lastMove > 8) { lastMove = t; Emit("{\"e\":\"move\"}"); }
      return false; // swallowing a move would freeze the pointer
    }

    if (msg == WM_MOUSEWHEEL)
    {
      // Only while HaloCut asks (a Tool wheel with several layouts is open): the scroll switches layout, not the timeline
      lock (gate) { if (!scrollOn) return false; }
      int delta = (short)((s.mouseData >> 16) & 0xFFFF);
      int dy = delta / 120;
      if (dy == 0 && delta != 0) dy = delta > 0 ? 1 : -1;
      if (dy != 0) Emit("{\"e\":\"scroll\",\"dy\":" + dy + "}");
      return true;
    }

    int b; bool down;
    switch (msg)
    {
      case WM_LBUTTONDOWN: b = 0; down = true; break;
      case WM_LBUTTONUP: b = 0; down = false; break;
      case WM_RBUTTONDOWN: b = 1; down = true; break;
      case WM_RBUTTONUP: b = 1; down = false; break;
      case WM_MBUTTONDOWN: b = 2; down = true; break;
      case WM_MBUTTONUP: b = 2; down = false; break;
      case WM_XBUTTONDOWN: b = ((s.mouseData >> 16) & 0xFFFF) == 1 ? 3 : 4; down = true; break;
      case WM_XBUTTONUP: b = ((s.mouseData >> 16) & 0xFFFF) == 1 ? 3 : 4; down = false; break;
      default: return false;
    }
    string key = "m" + b;

    if (down)
    {
      int m = Mods();
      lock (gate)
      {
        if (recording && (b != 0 || m != 0))
        {
          recording = false;
          swallowing[key] = 0;
          Emit("{\"e\":\"recorded\",\"kind\":\"mouse\",\"code\":" + b + ",\"mods\":" + ModsJson(m) + "}");
          return true;
        }
        Rule r = Match("mouse", b, m);
        if (r != null)
        {
          swallowing[key] = r.delayMs;
          if (r.delayMs > 0) pendingDown[key] = Now();
          Emit("{\"e\":\"down\",\"kind\":\"mouse\",\"code\":" + b + ",\"mods\":" + ModsJson(m) + ",\"blocked\":true}");
          return true;
        }
      }
      Emit("{\"e\":\"down\",\"kind\":\"mouse\",\"code\":" + b + ",\"mods\":" + ModsJson(m) + ",\"blocked\":false}");
      return false;
    }

    bool had, quick = false;
    lock (gate)
    {
      double delay, t0;
      had = swallowing.TryGetValue(key, out delay);
      swallowing.Remove(key);
      if (pendingDown.TryGetValue(key, out t0)) { pendingDown.Remove(key); quick = had && Now() - t0 < delay; }
    }
    Emit("{\"e\":\"up\",\"kind\":\"mouse\",\"code\":" + b + ",\"blocked\":" + B(had) + "}");
    if (!had) return false;
    if (quick) Replay(b);
    return true;
  }

  static bool Key(int msg, KBDLLHOOKSTRUCT s) // true = swallow
  {
    if (s.dwExtraInfo == TAG) return false;
    int vk = (int)s.vkCode;
    if (IsModifier(vk)) return false; // Ctrl, Alt, Shift and Win only count together with another key or button
    string key = "k" + vk;

    if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
    {
      int m = Mods();
      lock (gate)
      {
        bool rep = downKeys.Contains(vk);
        downKeys.Add(vk);
        if (recording && !rep)
        {
          recording = false;
          swallowing[key] = 0;
          if (vk == 0x1B) { Emit("{\"e\":\"recordCancelled\"}"); return true; } // Escape
          Emit("{\"e\":\"recorded\",\"kind\":\"key\",\"code\":" + vk + ",\"mods\":" + ModsJson(m) + "}");
          return true;
        }
        bool held = swallowing.ContainsKey(key);
        Rule r = held ? null : Match("key", vk, m);
        if (r != null) swallowing[key] = 0;
        bool blocked = held || r != null;
        Emit("{\"e\":\"down\",\"kind\":\"key\",\"code\":" + vk + ",\"mods\":" + ModsJson(m) + ",\"repeat\":" + B(rep) + ",\"blocked\":" + B(blocked) + "}");
        return blocked;
      }
    }

    bool was;
    lock (gate) { downKeys.Remove(vk); was = swallowing.Remove(key); }
    Emit("{\"e\":\"up\",\"kind\":\"key\",\"code\":" + vk + ",\"blocked\":" + B(was) + "}");
    return was;
  }

  static IntPtr MouseHook(int nCode, IntPtr wParam, IntPtr lParam)
  {
    if (nCode >= 0)
    {
      bool swallow = false;
      try { swallow = Mouse(wParam.ToInt32(), (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT))); } catch { /* let it through */ }
      if (swallow) return (IntPtr)1;
    }
    return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
  }

  static IntPtr KeyHook(int nCode, IntPtr wParam, IntPtr lParam)
  {
    if (nCode >= 0)
    {
      bool swallow = false;
      try { swallow = Key(wParam.ToInt32(), (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT))); } catch { /* let it through */ }
      if (swallow) return (IntPtr)1;
    }
    return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
  }

  // ---- the app in front ------------------------------------------------------------

  static string ExePath(uint pid)
  {
    IntPtr h = OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
    if (h == IntPtr.Zero) return "";
    try
    {
      StringBuilder sb = new StringBuilder(1024);
      uint size = (uint)sb.Capacity;
      return QueryFullProcessImageName(h, 0, sb, ref size) ? sb.ToString() : "";
    }
    finally { CloseHandle(h); }
  }

  static void Front(object state)
  {
    try
    {
      uint pid;
      IntPtr w = GetForegroundWindow();
      if (w == IntPtr.Zero) return;
      GetWindowThreadProcessId(w, out pid);
      string path = ExePath(pid);
      string k = pid + "|" + path;
      if (k == frontKey) return;
      frontKey = k;
      string name = "", id = "";
      if (path.Length > 0)
      {
        id = Path.GetFileName(path).ToLowerInvariant();
        try { name = FileVersionInfo.GetVersionInfo(path).FileDescription ?? ""; } catch { /* no version block */ }
        if (name.Trim().Length == 0) name = Path.GetFileNameWithoutExtension(path);
      }
      Emit("{\"e\":\"front\",\"name\":\"" + Esc(name) + "\",\"id\":\"" + Esc(id) + "\",\"path\":\"" + Esc(path) + "\"}");
    }
    catch { /* asked again in a moment */ }
  }

  // ---- commands from HaloCut -------------------------------------------------------

  static void Command(string line)
  {
    Dictionary<string, object> obj;
    try { obj = new JavaScriptSerializer().DeserializeObject(line) as Dictionary<string, object>; } catch { return; }
    if (obj == null || !obj.ContainsKey("cmd")) return;
    string cmd = obj["cmd"] as string;
    lock (gate)
    {
      if (cmd == "rules")
      {
        List<Rule> next = new List<Rule>();
        object[] list = obj.ContainsKey("rules") ? obj["rules"] as object[] : null;
        if (list != null)
        {
          foreach (object o in list)
          {
            Dictionary<string, object> r = o as Dictionary<string, object>;
            if (r == null || !r.ContainsKey("kind") || !r.ContainsKey("code")) continue;
            Rule rule = new Rule();
            rule.kind = r["kind"] as string;
            try { rule.code = Convert.ToInt32(r["code"]); } catch { continue; }
            object[] ms = r.ContainsKey("mods") ? r["mods"] as object[] : null;
            if (ms != null)
            {
              foreach (object mo in ms)
              {
                string m = mo as string;
                if (m == "ctrl") rule.mods |= 1; else if (m == "alt") rule.mods |= 2; else if (m == "shift") rule.mods |= 4; else if (m == "cmd") rule.mods |= 8;
              }
            }
            try { rule.delayMs = r.ContainsKey("delayMs") && r["delayMs"] != null ? Convert.ToDouble(r["delayMs"]) : 0; } catch { rule.delayMs = 0; }
            next.Add(rule);
          }
        }
        rules = next;
      }
      else if (cmd == "scroll") { scrollOn = obj.ContainsKey("on") && obj["on"] is bool && (bool)obj["on"]; }
      else if (cmd == "record") { recording = true; }
      else if (cmd == "cancelRecord") { recording = false; }
    }
  }

  static void ReadCommands()
  {
    try
    {
      StreamReader stdin = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
      string line;
      while ((line = stdin.ReadLine()) != null) { if (line.Trim().Length > 0) Command(line); }
    }
    catch { /* the pipe closed */ }
    Environment.Exit(0); // HaloCut went away
  }

  static void Main()
  {
    StreamWriter w = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
    w.AutoFlush = true;
    stdout = w;

    Thread reader = new Thread(ReadCommands);
    reader.IsBackground = true;
    reader.Start();

    mouseProc = MouseHook; keyProc = KeyHook;
    IntPtr mod = GetModuleHandle(null);
    IntPtr mh = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, mod, 0);
    IntPtr kh = SetWindowsHookEx(WH_KEYBOARD_LL, keyProc, mod, 0);
    if (mh == IntPtr.Zero || kh == IntPtr.Zero)
    {
      Emit("{\"e\":\"error\",\"msg\":\"Windows did not let HaloCut watch the mouse and keyboard (error " + Marshal.GetLastWin32Error() + ")\"}");
      Environment.Exit(2);
    }
    Emit("{\"e\":\"ready\",\"listenOnly\":false}");
    frontTimer = new Timer(Front, null, 0, 400);

    MSG msg;
    while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { /* the hooks run inside GetMessage */ }
  }
}
