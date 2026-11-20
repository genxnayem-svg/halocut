// ew-apps: Windows helper for HaloCut's Orbit switch. The same job and the same messages as the macOS helper (ew-apps.swift).
// Lists open apps (most recently used first) with their windows, hands out app icons,
// and brings an app or one of its windows to the front.
//
// stdin  (JSON lines): {"id":1,"cmd":"list"}  {"id":2,"cmd":"icon","path":"C:\\...\\app.exe","size":64}
//                      {"id":3,"cmd":"activate","pid":123}  {"id":4,"cmd":"raise","pid":123,"index":0}
//                      {"id":5,"cmd":"installed"}  {"id":6,"cmd":"launch","path":"C:\\...\\app.exe"}
// stdout (JSON lines): {"id":1,"apps":[{"pid":..,"name":..,"bundleId":"photoshop.exe","path":..,"front":B,"windows":[{"title":..,"minimized":B}]}]}
//                      {"id":2,"png":"<base64>"}  {"id":3,"ok":true}
// An app's id ("bundleId") on Windows is the name of its .exe, in lower case.
//
// Plain C# 5, so the compiler that ships with Windows builds it (see src/win-helper.js):
//   csc /target:exe /r:System.Web.Extensions.dll /r:System.Drawing.dll ew-apps.cs
// © 2026 Imtayz Nayem
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

static class EwApps
{
  delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hWnd, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hWnd, int index);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from, uint to, bool attach);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder name, ref uint size);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out int value, int size);

  static readonly JavaScriptSerializer json = new JavaScriptSerializer();
  static readonly uint selfPid = (uint)Process.GetCurrentProcess().Id;
  static readonly HashSet<string> skipExes = new HashSet<string>(new string[] { "halocut.exe", "electron.exe" });
  static readonly HashSet<string> skipClasses = new HashSet<string>(new string[] { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd" });
  static readonly Dictionary<uint, List<IntPtr>> windowCache = new Dictionary<uint, List<IntPtr>>();
  static readonly Dictionary<string, string> nameCache = new Dictionary<string, string>();
  static TextWriter stdout;

  static void Reply(Dictionary<string, object> obj)
  {
    try { stdout.WriteLine(json.Serialize(obj)); } catch { /* HaloCut went away */ }
  }

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

  // "Adobe Photoshop 2026" from the .exe's own description; its file name when it has none
  static string AppName(string path)
  {
    string name;
    if (nameCache.TryGetValue(path, out name)) return name;
    name = "";
    try { name = FileVersionInfo.GetVersionInfo(path).FileDescription ?? ""; } catch { /* no version block */ }
    if (name.Trim().Length == 0) name = Path.GetFileNameWithoutExtension(path);
    nameCache[path] = name;
    return name;
  }

  static string Title(IntPtr w)
  {
    int n = GetWindowTextLength(w);
    if (n <= 0) return "";
    StringBuilder sb = new StringBuilder(n + 2);
    GetWindowText(w, sb, sb.Capacity);
    return sb.ToString();
  }

  // Ordinary app windows only: shown, with a title, not owned by another window, not a tool window, not a hidden store app
  static bool IsAppWindow(IntPtr w)
  {
    if (!IsWindowVisible(w) || GetWindowTextLength(w) == 0) return false;
    if (GetWindow(w, 4) != IntPtr.Zero) return false;       // GW_OWNER
    if ((GetWindowLong(w, -20) & 0x80) != 0) return false;  // WS_EX_TOOLWINDOW
    StringBuilder cls = new StringBuilder(128);
    GetClassName(w, cls, cls.Capacity);
    if (skipClasses.Contains(cls.ToString())) return false;
    try { int cloaked; if (DwmGetWindowAttribute(w, 14, out cloaked, 4) == 0 && cloaked != 0) return false; } catch { /* no DWM */ }
    return true;
  }

  // Top-level windows come front to back, which is close to "most recently used".
  static List<object> ListApps()
  {
    List<uint> order = new List<uint>();
    Dictionary<uint, List<IntPtr>> byPid = new Dictionary<uint, List<IntPtr>>();
    EnumWindows(delegate(IntPtr w, IntPtr l)
    {
      if (!IsAppWindow(w)) return true;
      uint pid;
      GetWindowThreadProcessId(w, out pid);
      if (pid == 0 || pid == selfPid) return true;
      if (!byPid.ContainsKey(pid)) { byPid[pid] = new List<IntPtr>(); order.Add(pid); }
      byPid[pid].Add(w);
      return true;
    }, IntPtr.Zero);

    uint frontPid = 0;
    IntPtr fw = GetForegroundWindow();
    if (fw != IntPtr.Zero) GetWindowThreadProcessId(fw, out frontPid);

    windowCache.Clear();
    List<object> apps = new List<object>();
    foreach (uint pid in order)
    {
      string path = ExePath(pid);
      if (path.Length == 0) continue; // a system window we are not allowed to ask about
      string id = Path.GetFileName(path).ToLowerInvariant();
      if (skipExes.Contains(id)) continue;
      List<IntPtr> ws = byPid[pid];
      windowCache[pid] = ws;
      List<object> windows = new List<object>();
      foreach (IntPtr w in ws)
      {
        Dictionary<string, object> wo = new Dictionary<string, object>();
        wo["title"] = Title(w);
        wo["minimized"] = IsIconic(w);
        windows.Add(wo);
      }
      Dictionary<string, object> a = new Dictionary<string, object>();
      a["pid"] = (int)pid;
      a["name"] = AppName(path);
      a["bundleId"] = id;
      a["path"] = path;
      a["front"] = pid == frontPid;
      a["hidden"] = false;
      a["windows"] = windows;
      apps.Add(a);
    }
    return apps;
  }

  static string IconPng(string path, int size)
  {
    try
    {
      using (Icon ic = Icon.ExtractAssociatedIcon(path))
      using (Bitmap src = ic.ToBitmap())
      using (Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb))
      using (Graphics g = Graphics.FromImage(bmp))
      using (MemoryStream ms = new MemoryStream())
      {
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.DrawImage(src, 0, 0, size, size);
        bmp.Save(ms, ImageFormat.Png);
        return Convert.ToBase64String(ms.ToArray());
      }
    }
    catch { return ""; }
  }

  // Apps with a Start menu shortcut, for pinning on the wheel.
  static List<object> Installed()
  {
    List<object> found = new List<object>();
    HashSet<string> seen = new HashSet<string>();
    object shell = null;
    try { shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell")); } catch { return found; }
    string[] roots = new string[] {
      Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
      Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
    };
    SortedDictionary<string, Dictionary<string, object>> sorted = new SortedDictionary<string, Dictionary<string, object>>(StringComparer.OrdinalIgnoreCase);
    foreach (string root in roots)
    {
      string[] links;
      try { links = Directory.GetFiles(root, "*.lnk", SearchOption.AllDirectories); } catch { continue; }
      foreach (string lnk in links)
      {
        try
        {
          string name = Path.GetFileNameWithoutExtension(lnk);
          if (name.IndexOf("uninstall", StringComparison.OrdinalIgnoreCase) >= 0) continue;
          object sc = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
          string target = sc.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, sc, null) as string;
          if (string.IsNullOrEmpty(target) || !target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(target)) continue;
          string id = Path.GetFileName(target).ToLowerInvariant();
          if (skipExes.Contains(id) || !seen.Add(id)) continue;
          Dictionary<string, object> a = new Dictionary<string, object>();
          a["name"] = name;
          a["bundleId"] = id;
          a["path"] = target;
          sorted[name + "|" + id] = a;
        }
        catch { /* a shortcut that would not open */ }
      }
    }
    foreach (Dictionary<string, object> a in sorted.Values) found.Add(a);
    return found;
  }

  // Windows only lets the app in front hand the front to another window: borrow the front window's input for a moment,
  // and tap Alt if that was not enough.
  static bool Raise(IntPtr w)
  {
    if (w == IntPtr.Zero || !IsWindow(w)) return false;
    if (IsIconic(w)) ShowWindow(w, 9); // SW_RESTORE
    uint ignored;
    uint mine = GetCurrentThreadId();
    uint front = GetWindowThreadProcessId(GetForegroundWindow(), out ignored);
    bool attached = front != 0 && front != mine && AttachThreadInput(front, mine, true);
    BringWindowToTop(w);
    bool ok = SetForegroundWindow(w);
    if (attached) AttachThreadInput(front, mine, false);
    if (!ok || GetForegroundWindow() != w)
    {
      keybd_event(0x12, 0, 0, UIntPtr.Zero);
      keybd_event(0x12, 0, 2, UIntPtr.Zero);
      ok = SetForegroundWindow(w);
    }
    return ok;
  }

  static List<IntPtr> WindowsOf(uint pid)
  {
    List<IntPtr> ws;
    if (windowCache.TryGetValue(pid, out ws)) return ws;
    ListApps();
    return windowCache.TryGetValue(pid, out ws) ? ws : new List<IntPtr>();
  }

  static int Int(Dictionary<string, object> obj, string key, int fallback)
  {
    try { return obj.ContainsKey(key) && obj[key] != null ? Convert.ToInt32(obj[key]) : fallback; } catch { return fallback; }
  }

  static void Handle(string line)
  {
    Dictionary<string, object> obj;
    try { obj = json.DeserializeObject(line) as Dictionary<string, object>; } catch { return; }
    if (obj == null || !obj.ContainsKey("cmd")) return;
    string cmd = obj["cmd"] as string;
    Dictionary<string, object> r = new Dictionary<string, object>();
    r["id"] = obj.ContainsKey("id") ? obj["id"] : 0;
    uint pid = (uint)Int(obj, "pid", 0);
    string path = obj.ContainsKey("path") ? obj["path"] as string : "";
    try
    {
      if (cmd == "list") { r["apps"] = ListApps(); r["trusted"] = true; }
      else if (cmd == "icon") { r["png"] = IconPng(path ?? "", Int(obj, "size", 64)); }
      else if (cmd == "activate")
      {
        List<IntPtr> ws = WindowsOf(pid);
        r["ok"] = ws.Count > 0 && Raise(ws[0]);
      }
      else if (cmd == "raise")
      {
        List<IntPtr> ws = WindowsOf(pid);
        int i = Int(obj, "index", 0);
        r["ok"] = ws.Count > 0 && Raise(ws[i >= 0 && i < ws.Count ? i : 0]);
      }
      else if (cmd == "installed") { r["apps"] = Installed(); }
      else if (cmd == "launch") { Process.Start(path); r["ok"] = true; } // a pinned app that isn't open yet
      else { r["error"] = "unknown command " + cmd; }
    }
    catch (Exception e) { r["ok"] = false; r["error"] = e.Message; }
    Reply(r);
  }

  [STAThread]
  static void Main()
  {
    StreamWriter w = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
    w.AutoFlush = true;
    stdout = w;
    StreamReader stdin = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
    string line;
    try { while ((line = stdin.ReadLine()) != null) { if (line.Trim().Length > 0) Handle(line); } }
    catch { /* the pipe closed */ }
  }
}
