using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

// Private stdin/stdout transport; the helper has no network listener or privilege elevation.
static class DesktopBridge {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 16000000 };
    delegate bool EnumProc(IntPtr h, IntPtr p);
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct CursorPoint { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct Mouse { public int dx, dy; public uint data, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct Keyboard { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] struct Union { [FieldOffset(0)] public Mouse mouse; [FieldOffset(0)] public Keyboard key; }
    [StructLayout(LayoutKind.Sequential)] struct Input { public uint type; public Union u; }
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr p);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int size);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out Rect r);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attribute, out Rect r, int size);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint command);
    [DllImport("user32.dll")] static extern IntPtr GetLastActivePopup(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int command);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] static extern uint SendInput(uint n, Input[] input, int size);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out CursorPoint p);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(CursorPoint p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flag);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetUserObjectInformation(IntPtr h, int index, StringBuilder value, int size, out int needed);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    static string Str(Dictionary<string, object> a, string k, string fallback = "") { return a.ContainsKey(k) ? Convert.ToString(a[k]) : fallback; }
    static int Num(Dictionary<string, object> a, string k, int fallback = 0) { return a.ContainsKey(k) ? Convert.ToInt32(a[k]) : fallback; }
    static Dictionary<string, object> Obj(params object[] pairs) { var d = new Dictionary<string, object>(); for (int i=0; i<pairs.Length; i+=2) d[(string)pairs[i]]=pairs[i+1]; return d; }
    static void CheckDesktop() {
        IntPtr desktop = OpenInputDesktop(0, false, 1);
        if (desktop == IntPtr.Zero) throw new Exception("Desktop is locked or a secure UAC desktop is active. Unlock Windows first.");
        try { var name=new StringBuilder(256); int needed; if (!GetUserObjectInformation(desktop,2,name,512,out needed) || name.ToString()!="Default") throw new Exception("Interactive desktop unavailable: unlock Windows or dismiss the screen saver; secure/UAC desktops cannot be controlled."); }
        finally { CloseDesktop(desktop); }
    }
    static Dictionary<string, object> WindowInfo(IntPtr h) {
        if (!IsWindow(h)) throw new Exception("Window no longer exists.");
        uint pid; GetWindowThreadProcessId(h,out pid);
        string exe=Process.GetProcessById((int)pid).MainModule.FileName;
        var title=new StringBuilder(1024); GetWindowText(h,title,title.Capacity);
        Rect r; if (!GetWindowRect(h,out r)) throw new Exception("Window bounds unavailable.");
        // GetWindowRect includes invisible resize borders (e.g. -8 on a maximized Chrome window).
        // Use visible physical frame bounds consistently for capture AND input validation.
        Rect frame; if(DwmGetWindowAttribute(h,9,out frame,Marshal.SizeOf(typeof(Rect)))==0 && frame.Right>frame.Left && frame.Bottom>frame.Top) r=frame;
        return Obj("windowId",h.ToInt64().ToString(),"ownerWindowId",GetWindow(h,4).ToInt64().ToString(),"pid",pid,"appId",exe,"title",title.ToString(),"left",r.Left,"top",r.Top,"width",r.Right-r.Left,"height",r.Bottom-r.Top,"focused",h==GetForegroundWindow(),"minimized",IsIconic(h));
    }
    // Follow only visible owned windows in the same process. Never adopt an unrelated app.
    static bool OwnedBy(IntPtr child, IntPtr parent) {
        uint cp, pp; GetWindowThreadProcessId(child,out cp); GetWindowThreadProcessId(parent,out pp);
        if(cp!=pp) return false;
        for(int i=0; child!=IntPtr.Zero && i<16; i++,child=GetWindow(child,4)) if(child==parent) return true;
        return false;
    }
    static object FocusedControl(IntPtr target) {
        try {
            var e=AutomationElement.FocusedElement; if(e==null) return null;
            uint pid; GetWindowThreadProcessId(target,out pid);
            if(e.Current.ProcessId!=(int)pid || GetForegroundWindow()!=target) return null;
            if(e.Current.IsPassword) return Obj("protected",true);
            return Obj("runtimeId",String.Join(".",e.GetRuntimeId()),"name",e.Current.Name,"type",e.Current.ControlType.ProgrammaticName);
        } catch { return null; }
    }
    static IntPtr ActiveTarget(IntPtr target) {
        var foreground=GetForegroundWindow();
        if(IsWindowVisible(foreground) && OwnedBy(foreground,target)) return foreground;
        for(int i=0;i<16;i++) {
            var popup=GetLastActivePopup(target);
            if(popup==target || !IsWindowVisible(popup) || !OwnedBy(popup,target)) break;
            target=popup;
        }
        return target;
    }
    static IntPtr Target(Dictionary<string, object> a, bool focus) {
        var h=new IntPtr(long.Parse(Str(a,"windowId"))); var w=WindowInfo(h);
        if (!String.Equals((string)w["appId"],Str(a,"appId"),StringComparison.OrdinalIgnoreCase) || Convert.ToInt32(w["pid"])!=Num(a,"pid")) throw new Exception("Window identity changed. Observe again.");
        if (focus && (h!=GetForegroundWindow() || IsIconic(h))) throw new Exception("Target window lost focus. Focus it and capture again.");
        if (a.ContainsKey("left") && (Num(a,"left")!=Num(w,"left") || Num(a,"top")!=Num(w,"top") || Num(a,"width")!=Num(w,"width") || Num(a,"height")!=Num(w,"height"))) throw new Exception("Window moved or resized. Capture it again.");
        return h;
    }
    static void Send(params Input[] input) {
        if (SendInput((uint)input.Length,input,Marshal.SizeOf(typeof(Input))) == input.Length) return;
        // Release only keys/buttons this batch intended to release, never arbitrary user keys.
        var release=new List<Input>(); foreach(var i in input) if ((i.type==1 && (i.u.key.flags&2)!=0) || (i.type==0 && (i.u.mouse.flags==4 || i.u.mouse.flags==16))) release.Add(i);
        if(release.Count>0) SendInput((uint)release.Count,release.ToArray(),Marshal.SizeOf(typeof(Input)));
        throw new Exception("Input was blocked or only partially sent. Inspect the result before trying again (elevated applications may be inaccessible).");
    }
    static Input Key(ushort vk, ushort scan, uint flags) { return new Input { type=1,u=new Union { key=new Keyboard { vk=vk,scan=scan,flags=flags } } }; }
    static Input MouseEvent(uint flags,uint data=0) { return new Input { type=0,u=new Union { mouse=new Mouse { flags=flags,data=data } } }; }
    static void Unmodified() { foreach(int key in new int[]{16,17,18,91,92}) if ((GetAsyncKeyState(key)&0x8000)!=0) throw new Exception("A modifier key is held. Release it before automated input."); }
    static List<object> Controls(IntPtr h) {
        var results=new List<object>(); var walker=TreeWalker.ControlViewWalker;
        var queue=new Queue<AutomationElement>(); queue.Enqueue(AutomationElement.FromHandle(h));
        var clock=Stopwatch.StartNew(); int visited=0;
        while(queue.Count>0 && visited++<300 && results.Count<100 && clock.ElapsedMilliseconds<2000) {
            var e=queue.Dequeue(); try {
                var c=e.Current; if (c.IsPassword) continue;
                var b=c.BoundingRectangle;
                if (!c.IsOffscreen && (c.Name.Length>0 || c.IsKeyboardFocusable)) results.Add(Obj("name",c.Name.Length>250?c.Name.Substring(0,250):c.Name,"type",c.ControlType.ProgrammaticName,"automationId",c.AutomationId,"focused",c.HasKeyboardFocus,"left",b.Left,"top",b.Top,"width",b.Width,"height",b.Height));
                var child=walker.GetFirstChild(e); int siblings=0; while(child!=null && siblings++<100) { queue.Enqueue(child); child=walker.GetNextSibling(child); }
            } catch(ElementNotAvailableException) { }
        }
        return results;
    }
    static object Dispatch(Dictionary<string,object> a) {
        CheckDesktop(); string action=Str(a,"action");
        if (action=="list_displays") {
            var displays=new List<object>(); foreach(var display in Screen.AllScreens) { var b=display.Bounds; var w=display.WorkingArea; displays.Add(Obj("displayId",display.DeviceName,"primary",display.Primary,"left",b.Left,"top",b.Top,"width",b.Width,"height",b.Height,"workLeft",w.Left,"workTop",w.Top,"workWidth",w.Width,"workHeight",w.Height)); } return displays;
        }
        if (action=="list_windows") {
            var windows=new List<object>(); EnumWindows(delegate(IntPtr h,IntPtr p) { try { if (IsWindowVisible(h)) { var w=WindowInfo(h); if ((string)w["title"]!="") windows.Add(w); } } catch { } return windows.Count<200; },IntPtr.Zero); return windows;
        }
        if (action=="capture_screen" && !a.ContainsKey("windowId")) {
            Screen display=Screen.PrimaryScreen;
            if(a.ContainsKey("displayId")) { display=null; foreach(var candidate in Screen.AllScreens) if(candidate.DeviceName==Str(a,"displayId")) display=candidate; if(display==null) throw new Exception("Monitor disconnected. List displays again."); }
            var result=(Dictionary<string,object>)Capture(display.Bounds, null); result["displayId"]=display.DeviceName; return result;
        }
        if(action=="observe_active") {
            // Allow native dialogs to finish opening before choosing the next target.
            Thread.Sleep(350);
            var previous=new IntPtr(long.Parse(Str(a,"windowId")));
            if(!IsWindow(previous) && Str(a,"ownerWindowId","0")!="0") {
                var owner=WindowInfo(new IntPtr(long.Parse(Str(a,"ownerWindowId"))));
                if(Str(owner,"appId")!=Str(a,"appId") || Num(owner,"pid")!=Num(a,"pid")) throw new Exception("Window identity changed. Observe again.");
                a=owner;
            }
        }
        IntPtr target=Target(a,false);
        if(action=="prepare_desktop" || action=="observe_active") {
            target=ActiveTarget(target);
            if(action=="prepare_desktop") {
                if(IsIconic(target)) ShowWindow(target,9);
                if(GetForegroundWindow()!=target) { SetForegroundWindow(target); Thread.Sleep(150); }
                target=ActiveTarget(target);
                if(GetForegroundWindow()!=target) throw new Exception("FOCUS_REQUIRED: Windows refused focus. Bring the requested app or its dialog to the front, then prepare_desktop once. Repeated screenshots cannot fix focus.");
            }
            if(IsIconic(target)) throw new Exception("Window is minimized; prepare_desktop before input.");
            var w=WindowInfo(target);
            return Capture(new Rectangle(Num(w,"left"),Num(w,"top"),Num(w,"width"),Num(w,"height")),w);
        }
        if (action=="focus_window") { if (IsIconic(target)) ShowWindow(target,9); SetForegroundWindow(target); Thread.Sleep(150); if (GetForegroundWindow()!=target) throw new Exception("Windows refused foreground focus. Select the app manually and retry."); return WindowInfo(target); }
        if (action=="inspect_window") return Obj("window",WindowInfo(target),"controls",Controls(target));
        if (action=="move_window") {
            Screen display=null; foreach(var candidate in Screen.AllScreens) if(candidate.DeviceName==Str(a,"displayId")) display=candidate;
            if(display==null) throw new Exception("Monitor disconnected. List displays again.");
            ShowWindow(target,9); var area=display.WorkingArea; var info=WindowInfo(target);
            if(!SetWindowPos(target,IntPtr.Zero,area.Left,area.Top,Math.Min(Num(info,"width"),area.Width),Math.Min(Num(info,"height"),area.Height),0x14)) throw new Exception("Windows refused window movement (possibly elevated).");
            Thread.Sleep(150); return Obj("window",WindowInfo(target),"displayId",display.DeviceName);
        }
        if (action=="capture_screen") { if(IsIconic(target)) throw new Exception("Window is minimized; restore it before observing."); var w=WindowInfo(target); return Capture(new Rectangle(Num(w,"left"),Num(w,"top"),Num(w,"width"),Num(w,"height")),w); }
        target=Target(a,true);
        Unmodified();
        if (action=="click" || action=="scroll") {
            int x=Num(a,"x"),y=Num(a,"y"); var w=WindowInfo(target);
            if (x<Num(w,"left") || y<Num(w,"top") || x>=Num(w,"left")+Num(w,"width") || y>=Num(w,"top")+Num(w,"height")) throw new Exception("Point is outside the target window.");
            if (!SetCursorPos(x,y)) throw new Exception("Pointer movement failed.");
            CursorPoint p; GetCursorPos(out p); var covering=GetAncestor(WindowFromPoint(p),2);
            if (covering!=target) throw new Exception("WINDOW_COVERED: Click was not sent. The point belongs to window "+covering.ToInt64()+". Use list_windows then prepare_desktop for the intended dialog/window; do not repeat the old coordinates.");
            if(action=="scroll") { int amount=Num(a,"amount"); if (Math.Abs(amount)>2400) throw new Exception("Scroll amount is too large."); Send(MouseEvent(0x0800,unchecked((uint)amount))); }
            else { string button=Str(a,"button","left"); uint down=button=="right"?8u:2u; int count=Num(a,"count",1); if(count<1 || count>2) throw new Exception("Invalid click count."); for(int i=0;i<count;i++) { Target(a,true); Send(MouseEvent(down),MouseEvent(down*2)); if(i+1<count) Thread.Sleep(60); } }
        } else if(action=="type_text") {
            if(a.ContainsKey("expectedFocus")) {
                var current=FocusedControl(target) as Dictionary<string,object>;
                if(current==null || current.ContainsKey("protected") || Str(current,"runtimeId")!=Str(a,"expectedFocus")) throw new Exception("FOCUS_CHANGED: Editable focus changed or is protected. Prepare the window and inspect focus before typing; no text was sent.");
            }
            string text=Str(a,"text"); if(text.Length>4000) throw new Exception("Text is too long.");
            text=text.Replace("\r\n","\n").Replace("\r","\n");
            for(int i=0;i<text.Length;i+=64) { Target(a,true); var inputs=new List<Input>(); foreach(char ch in text.Substring(i,Math.Min(64,text.Length-i))) { if(ch=='\n') { inputs.Add(Key(13,0,0)); inputs.Add(Key(13,0,2)); } else if(ch=='\t') { inputs.Add(Key(9,0,0)); inputs.Add(Key(9,0,2)); } else { inputs.Add(Key(0,ch,4)); inputs.Add(Key(0,ch,6)); } } Send(inputs.ToArray()); }
        } else if(action=="key_press") {
            var aliases=new Dictionary<string,ushort>(StringComparer.OrdinalIgnoreCase) { {"Ctrl",17},{"Control",17},{"Shift",16},{"Alt",18},{"Enter",13},{"Tab",9},{"Escape",27},{"Backspace",8},{"Delete",46},{"Space",32},{"Left",37},{"Up",38},{"Right",39},{"Down",40},{"Home",36},{"End",35},{"PageUp",33},{"PageDown",34} };
            string[] keys=Str(a,"keys").Split('+'); if(keys.Length>4) throw new Exception("Too many shortcut keys."); var pressed=new List<ushort>();
            foreach(string name in keys) { ushort code; if(aliases.TryGetValue(name,out code)) pressed.Add(code); else if(name.Length==1 && Char.IsLetterOrDigit(name[0])) pressed.Add((ushort)Char.ToUpperInvariant(name[0])); else if(name.StartsWith("F") && NumKey(name)>=1 && NumKey(name)<=12) pressed.Add((ushort)(111+NumKey(name))); else throw new Exception("Unsupported shortcut key: "+name); }
            var inputs=new List<Input>(); foreach(ushort code in pressed) inputs.Add(Key(code,0,code>=33 && code<=46?1u:0u)); pressed.Reverse(); foreach(ushort code in pressed) inputs.Add(Key(code,0,code>=33 && code<=46?3u:2u)); Send(inputs.ToArray());
        } else throw new Exception("Unknown desktop action.");
        Thread.Sleep(100); return Obj("sent",true,"window",WindowInfo(target));
    }
    static int NumKey(string name) { int n; return int.TryParse(name.Substring(1),out n)?n:0; }
    static object Capture(Rectangle rect, object window) {
        var visible=Rectangle.Intersect(rect,SystemInformation.VirtualScreen);
        if(visible.Width<=0 || visible.Height<=0 || (long)visible.Width*visible.Height>32000000) throw new Exception("Invalid or oversized screen bounds.");
        // Window coordinates must refer to the complete image, never a silently clipped frame.
        if(visible!=rect) throw new Exception("Window is partly off screen. Move it fully on screen and capture again.");
        using(var bitmap=new Bitmap(rect.Width,rect.Height)) using(var g=Graphics.FromImage(bitmap)) using(var stream=new MemoryStream()) {
            g.CopyFromScreen(rect.Location,Point.Empty,rect.Size); bitmap.Save(stream,ImageFormat.Png);
            var w=window as Dictionary<string,object>;
            return Obj("image",Convert.ToBase64String(stream.ToArray()),"left",rect.Left,"top",rect.Top,"width",rect.Width,"height",rect.Height,"window",window,"focusedControl",w==null?null:FocusedControl(new IntPtr(long.Parse(Str(w,"windowId")))));
        }
    }
    [STAThread] static void Main() {
        Console.InputEncoding=new UTF8Encoding(false); Console.OutputEncoding=new UTF8Encoding(false);
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch(EntryPointNotFoundException) { SetProcessDPIAware(); }
        string line; while((line=Console.ReadLine())!=null) { string id=""; try { var request=Json.Deserialize<Dictionary<string,object>>(line); id=Str(request,"id"); Console.WriteLine(Json.Serialize(Obj("id",id,"ok",true,"data",Dispatch(request)))); } catch(Exception e) { Console.WriteLine(Json.Serialize(Obj("id",id,"ok",false,"error",e.Message))); } }
    }
}
