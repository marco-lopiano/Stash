xAdd-Type -AssemblyName System.Windows.Forms, System.Drawing
Set-Location $PSScriptRoot

$script:port = 5173
$log = Join-Path $PSScriptRoot 'vite.log'

$script:proc = Start-Process -FilePath cmd.exe `
    -ArgumentList "/c npx vite preview --port $script:port --strictPort > `"$log`" 2>&1" `
    -WindowStyle Hidden -PassThru

# Tray icon (uses icon.ico if present, otherwise a default Windows icon)
$script:tray = New-Object System.Windows.Forms.NotifyIcon
$iconFile = Join-Path $PSScriptRoot 'icon.ico'
if (Test-Path $iconFile) { $tray.Icon = New-Object System.Drawing.Icon($iconFile) }
else { $tray.Icon = [System.Drawing.SystemIcons]::Application }
$tray.Text = 'LinkGrid server'
$tray.Visible = $true

# Right click menu for exiting app
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add('Open')
$exitItem = $menu.Items.Add('Exit')
$tray.ContextMenuStrip = $menu

function Stop-All {
    if ($script:proc -and -not $script:proc.HasExited) {
        taskkill /PID $script:proc.Id /T /F | Out-Null
    }
    $script:tray.Visible = $false
    $script:tray.Dispose()
    [System.Windows.Forms.Application]::Exit()
}

$openItem.Add_Click({ Start-Process "http://localhost:$script:port" })
$tray.Add_DoubleClick({ Start-Process "http://localhost:$script:port" })
$exitItem.Add_Click({ Stop-All })

# If the server dies on its own, remove the tray icon too
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({ if ($script:proc.HasExited) { Stop-All } })
$timer.Start()

[System.Windows.Forms.Application]::Run()