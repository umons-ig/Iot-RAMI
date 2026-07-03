"""
fix_sysroot.py - Pre-build script PlatformIO
---
La toolchain pioarduino riscv32-esp-elf 14.2.0 a deux problèmes sur macOS :

1. Sysroot mal imbriqué : GCC cherche stdint.h dans toolchain/riscv32-esp-elf/include/
   mais les headers sont dans toolchain/riscv32-esp-elf/riscv32-esp-elf/include/
   → Fix : symlinks des headers vers le bon emplacement du sysroot

2. Assembleur non préfixé : GCC appelle `as` (sans préfixe) qui résout vers le
   `as` macOS (clang), lequel refuse les flags RISC-V
   → Fix : symlink as → riscv32-esp-elf-as dans bin/
"""
Import("env")
import os

packages_dir = os.path.expanduser("~/.platformio/packages")
toolchain    = os.path.join(packages_dir, "toolchain-riscv32-esp")

# ── Fix 1 : sysroot headers ──────────────────────────────────────────────────
sysroot_include = os.path.join(toolchain, "riscv32-esp-elf", "include")
nested_include  = os.path.join(toolchain, "riscv32-esp-elf", "riscv32-esp-elf", "include")

if os.path.isdir(nested_include):
    if not os.path.isdir(sysroot_include):
        os.makedirs(sysroot_include)

    created = 0
    for item in os.listdir(nested_include):
        src = os.path.join(nested_include, item)
        dst = os.path.join(sysroot_include, item)
        if not os.path.exists(dst):
            os.symlink(src, dst)
            created += 1

    print(f"[fix_sysroot] headers : {created} symlink(s) créé(s)" if created else "[fix_sysroot] headers : déjà corrigés")

# ── Fix 2 : assembleur sans préfixe ──────────────────────────────────────────
bin_dir   = os.path.join(toolchain, "bin")
as_link   = os.path.join(bin_dir, "as")
as_target = os.path.join(bin_dir, "riscv32-esp-elf-as")

if os.path.isfile(as_target) and not os.path.exists(as_link):
    os.symlink(as_target, as_link)
    print("[fix_sysroot] assembleur : symlink as → riscv32-esp-elf-as créé")
else:
    print("[fix_sysroot] assembleur : déjà corrigé")

# ── Fix 3 : Network.h introuvable dans les libs WiFi du framework ────────────
# Arduino-ESP32 3.x a déplacé WiFiGeneric.h → dépend de Network.h (lib Network).
# PlatformIO ne propage pas ce chemin d'include aux librairies du framework.
# → on l'ajoute directement dans l'environnement de build SCons.
packages_dir = os.path.expanduser("~/.platformio/packages")
network_include = os.path.join(packages_dir, "framework-arduinoespressif32", "libraries", "Network", "src")
if os.path.isdir(network_include):
    env.Append(CPPPATH=[network_include])
    print(f"[fix_sysroot] Network.h : include path ajouté ({network_include})")
else:
    print("[fix_sysroot] Network.h : répertoire introuvable, skip")
