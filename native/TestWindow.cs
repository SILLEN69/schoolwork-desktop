using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Runtime.InteropServices;

// Disposable integration fixture only; never bundled with SchoolWork.
static class TestWindow {
    [DllImport("user32.dll")] static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flag);
    [STAThread] static void Main() {
        var json=new JavaScriptSerializer(); var form=new Form { Text="SchoolWork disposable desktop test", StartPosition=FormStartPosition.Manual, Location=new Point(70,70), Size=new Size(680,500) };
        var editor=new TextBox { Name="Editor", AccessibleName="Editor", Multiline=true, ScrollBars=ScrollBars.Vertical, Bounds=new Rectangle(20,20,610,300), Font=new Font("Consolas",14) };
        var password=new TextBox { AccessibleName="Password", UseSystemPasswordChar=true, Text="not-for-observation", Bounds=new Rectangle(20,335,250,30) };
        var button=new Button { Text="Click test", AccessibleName="Click test", Bounds=new Rectangle(300,335,200,35) }; int clicks=0, wheels=0;
        button.Click+=(s,e)=>{clicks++;}; editor.MouseWheel+=(s,e)=>{wheels++;}; form.Controls.Add(editor); form.Controls.Add(password); form.Controls.Add(button);
        form.Shown+=(s,e)=>{editor.Focus(); Console.WriteLine("ready"); Console.Out.Flush();};
        var reader=new Thread(()=>{string line; while((line=Console.ReadLine())!=null) { if(line=="focus") form.BeginInvoke(new Action(()=>{form.TopMost=true;form.BringToFront();Cursor.Position=editor.PointToScreen(new Point(20,20)); if(GetAncestor(WindowFromPoint(Cursor.Position),2)==form.Handle) {mouse_event(2,0,0,0,UIntPtr.Zero);mouse_event(4,0,0,0,UIntPtr.Zero);} form.TopMost=false;Console.WriteLine("focused");Console.Out.Flush();})); if(line=="state") form.BeginInvoke(new Action(()=>{Console.WriteLine(json.Serialize(new { text=editor.Text, clicks=clicks, wheels=wheels }));Console.Out.Flush();})); if(line=="close") {form.BeginInvoke(new Action(()=>form.Close()));break;} }}); reader.IsBackground=true; reader.Start();
        Application.Run(form);
    }
}
