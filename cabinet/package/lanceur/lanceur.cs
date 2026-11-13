// Espace cabinet : lanceur des exécutables (démonstration, mise à jour).
// Compilé par tools/build-package.mjs avec csc.exe, le compilateur C# fourni avec Windows (.NET Framework 4) : rien à télécharger.
// Contient deux ressources : script.ps1 et payload.zip. Il les copie dans un dossier temporaire, lance
//   powershell -File script.ps1 -Payload payload.zip
// dans sa propre fenêtre, attend la fin, nettoie et renvoie le code de sortie du script.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

static class Lanceur
{
    static void Extraire(string nom, string dest)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(nom))
        using (FileStream f = File.Create(dest))
        {
            if (s == null) throw new Exception("Ressource absente : " + nom);
            s.CopyTo(f);
        }
    }

    static int Main()
    {
        string tmp = Path.Combine(Path.GetTempPath(), "EspaceCabinet-" + Guid.NewGuid().ToString("N").Substring(0, 8));
        try
        {
            Console.Title = "Espace cabinet";
            Console.WriteLine();
            Console.WriteLine("  Espace cabinet - préparation des fichiers...");
            Directory.CreateDirectory(tmp);
            string script = Path.Combine(tmp, "script.ps1"), payload = Path.Combine(tmp, "payload.zip");
            Extraire("script.ps1", script);
            Extraire("payload.zip", payload);
            string ps = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe");
            ProcessStartInfo psi = new ProcessStartInfo(ps,
                "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\" -Payload \"" + payload + "\"");
            psi.UseShellExecute = false;
            psi.WorkingDirectory = tmp;
            using (Process p = Process.Start(psi))
            {
                p.WaitForExit();
                return p.ExitCode;
            }
        }
        catch (Exception e)
        {
            Console.WriteLine();
            Console.WriteLine("  Échec : " + e.Message);
            Console.WriteLine("  Envoyez une photo de cet écran à Talel. Appuyez sur Entrée pour fermer.");
            Console.ReadLine();
            return 1;
        }
        finally
        {
            try { Directory.Delete(tmp, true); } catch { }
        }
    }
}
