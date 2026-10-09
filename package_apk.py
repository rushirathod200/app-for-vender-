import zipfile
import subprocess
import os
import shutil

orig_apk = r"E:\xampp\htdocs\client\final deskdrop\deskdrop-vendor.apk"
backup_apk = r"E:\xampp\htdocs\client\final deskdrop\deskdrop-vendor.apk.bak"
new_bundle = r"E:\xampp\htdocs\client\final deskdrop\app-for-vender-\dist\index.android.bundle.hbc"
unaligned_apk = r"E:\xampp\htdocs\client\final deskdrop\app-for-vender-\dist\unaligned.apk"
aligned_apk = r"E:\xampp\htdocs\client\final deskdrop\app-for-vender-\dist\aligned.apk"
signed_apk = r"E:\xampp\htdocs\client\final deskdrop\deskdrop-vendor.apk"

zipalign_bin = r"C:\Users\intel\AppData\Local\Android\Sdk\build-tools\35.0.0\zipalign.exe"
apksigner_bin = r"C:\Users\intel\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"
keystore = r"E:\xampp\htdocs\client\final deskdrop\app-for-vender-\android\app\debug.keystore"

print("1. Backing up original APK...")
if not os.path.exists(backup_apk):
    shutil.copyfile(orig_apk, backup_apk)
    print("   Backup created at:", backup_apk)
else:
    print("   Backup already exists at:", backup_apk)

print("2. Repackaging APK with updated Hermes bundle...")
with open(new_bundle, 'rb') as fb:
    bundle_data = fb.read()

source_apk = backup_apk if os.path.exists(backup_apk) else orig_apk
with zipfile.ZipFile(source_apk, 'r') as zin, zipfile.ZipFile(unaligned_apk, 'w') as zout:
    for item in zin.infolist():
        # Exclude old META-INF signature files
        if item.filename.startswith("META-INF/") and (
            item.filename.endswith(".SF") or
            item.filename.endswith(".RSA") or
            item.filename.endswith(".DSA") or
            item.filename.endswith(".MF")
        ):
            continue

        if item.filename == "assets/index.android.bundle":
            print(f"   Replacing {item.filename} (old size: {item.file_size}, new size: {len(bundle_data)})")
            zout.writestr(item.filename, bundle_data, compress_type=zipfile.ZIP_DEFLATED)
        else:
            buffer = zin.read(item.filename)
            zout.writestr(item, buffer)

print("3. Running zipalign...")
if os.path.exists(aligned_apk):
    os.remove(aligned_apk)

align_res = subprocess.run([zipalign_bin, "-p", "-f", "4", unaligned_apk, aligned_apk], capture_output=True, text=True)
print("   zipalign return code:", align_res.returncode)
if align_res.returncode != 0:
    print("   zipalign stdout:", align_res.stdout)
    print("   zipalign stderr:", align_res.stderr)
    exit(1)

print("4. Signing APK with apksigner...")
sign_res = subprocess.run([
    apksigner_bin, "sign",
    "--ks", keystore,
    "--ks-pass", "pass:android",
    "--ks-key-alias", "androiddebugkey",
    "--key-pass", "pass:android",
    "--out", signed_apk,
    aligned_apk
], capture_output=True, text=True)
print("   apksigner return code:", sign_res.returncode)
if sign_res.returncode != 0:
    print("   apksigner stdout:", sign_res.stdout)
    print("   apksigner stderr:", sign_res.stderr)
    exit(1)

print("5. Verifying signed APK...")
verify_res = subprocess.run([apksigner_bin, "verify", "-v", "--print-certs", signed_apk], capture_output=True, text=True)
print("   Verification output:")
for line in verify_res.stdout.splitlines()[:15]:
    print("  ", line)

print("FINISHED SUCCESSFULLY! Updated APK is ready at:", signed_apk)
