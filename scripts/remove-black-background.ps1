param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

Add-Type -AssemblyName System.Drawing

if (-not ("WhiteLogoTransparency" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class WhiteLogoTransparency
{
    public static string Convert(string inputPath, string outputPath)
    {
        using (var sourceImage = Image.FromFile(inputPath))
        using (var source = new Bitmap(sourceImage.Width, sourceImage.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(source))
            {
                graphics.DrawImageUnscaled(sourceImage, 0, 0);
            }

            var sourceRect = new Rectangle(0, 0, source.Width, source.Height);
            var sourceData = source.LockBits(sourceRect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var sourceBytes = new byte[Math.Abs(sourceData.Stride) * source.Height];
            Marshal.Copy(sourceData.Scan0, sourceBytes, 0, sourceBytes.Length);
            source.UnlockBits(sourceData);

            var alpha = new byte[source.Width * source.Height];
            var left = source.Width;
            var top = source.Height;
            var right = -1;
            var bottom = -1;

            for (var y = 0; y < source.Height; y++)
            {
                var row = y * sourceData.Stride;
                for (var x = 0; x < source.Width; x++)
                {
                    var sourceIndex = row + x * 4;
                    var blue = sourceBytes[sourceIndex];
                    var green = sourceBytes[sourceIndex + 1];
                    var red = sourceBytes[sourceIndex + 2];
                    var luminance = (red * 54 + green * 183 + blue * 19) >> 8;
                    var opacity = luminance <= 4 ? 0 : Math.Min(255, (luminance - 4) * 255 / 251);
                    alpha[y * source.Width + x] = (byte)opacity;
                    if (opacity == 0) continue;
                    if (x < left) left = x;
                    if (x > right) right = x;
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                }
            }

            if (right < left || bottom < top)
            {
                throw new InvalidOperationException("The source image contains no visible white artwork.");
            }

            const int padding = 12;
            left = Math.Max(0, left - padding);
            top = Math.Max(0, top - padding);
            right = Math.Min(source.Width - 1, right + padding);
            bottom = Math.Min(source.Height - 1, bottom + padding);

            var outputWidth = right - left + 1;
            var outputHeight = bottom - top + 1;
            using (var output = new Bitmap(outputWidth, outputHeight, PixelFormat.Format32bppArgb))
            {
                var outputRect = new Rectangle(0, 0, outputWidth, outputHeight);
                var outputData = output.LockBits(outputRect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                var outputBytes = new byte[Math.Abs(outputData.Stride) * outputHeight];

                for (var y = 0; y < outputHeight; y++)
                {
                    var sourceY = top + y;
                    var outputRow = y * outputData.Stride;
                    for (var x = 0; x < outputWidth; x++)
                    {
                        var opacity = alpha[sourceY * source.Width + left + x];
                        var outputIndex = outputRow + x * 4;
                        outputBytes[outputIndex] = 255;
                        outputBytes[outputIndex + 1] = 255;
                        outputBytes[outputIndex + 2] = 255;
                        outputBytes[outputIndex + 3] = opacity;
                    }
                }

                Marshal.Copy(outputBytes, 0, outputData.Scan0, outputBytes.Length);
                output.UnlockBits(outputData);

                var directory = Path.GetDirectoryName(outputPath);
                if (!String.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
                output.Save(outputPath, ImageFormat.Png);
                return outputWidth + "x" + outputHeight;
            }
        }
    }
}
"@
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$dimensions = [WhiteLogoTransparency]::Convert($resolvedInput, $resolvedOutput)
Write-Output "Created $resolvedOutput ($dimensions)"
