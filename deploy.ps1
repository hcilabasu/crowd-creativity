<# 
USAGE

Simply run this script on powershell. It will generate a web2py.app.compiled.w2p file.

To deploy the generated app version, use the server's web2py admin interface: On "Upload and install packed application", 
type the name of the application, select this file (under "upload a package"), and select "Overwrite installed app".
Hit install and wait for the instalation to conclude.
#> 

Write-Host Starting deployment script

# Replacing appconfig files
Write-Host Switching appconfig.ini files...
cd private
Rename-Item appconfig.ini temp.appconfig.ini # Temporarily rename dev appconfig
Rename-Item private.appconfig.ini appconfig.ini # Switch production appconfig to non private
cd ..

# Delete previously compiled files
Write-Host Deleting previously compiled files...
if (Test-Path web2py.crowdmuse.compiled.w2p){
    Remove-Item web2py.crowdmuse.compiled.w2p
    Write-Host "-- Deleted web2py.crowdmuse.compiled.w2p"
}
if (Test-Path compiled){
    Remove-Item compiled -Recurse 
    Write-Host "-- Deleted compiled directory"
}

# Compile
Write-Host Compiling app...
# python -c "import gluon.compileapp; gluon.compileapp.compile_application('..\\..\\applications\\crowdmuse')"

# Pack app
Write-Host Packing app...
7z.exe a -ttar web2py.crowdmuse.compiled.tar *
7z.exe a -tgzip web2py.crowdmuse.compiled.w2p web2py.crowdmuse.compiled.tar

# Clean up
Write-Host Cleaning up...
Remove-Item web2py.crowdmuse.compiled.tar
cd private
Rename-Item appconfig.ini private.appconfig.ini # Make production appconfig private again
Rename-Item temp.appconfig.ini appconfig.ini # Remove temp from dev appconfig
cd ..

Write-Host Done!