[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null
$bmp = New-Object System.Drawing.Bitmap("c:/Users/User/Documents/heian-quote/public/assets/logo.png")
$pixel = $bmp.GetPixel(0,0)
$hex = [System.Drawing.ColorTranslator]::ToHtml($pixel)
Write-Output $hex
$bmp.Dispose()
