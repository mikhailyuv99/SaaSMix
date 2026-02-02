# Colab: exécuter cette cellule pour patcher setup.py avant pip install -e .

setup_py = "/content/DeepAFx-ST/setup.py"
with open(setup_py, "r") as f:
    content = f.read()

# Retirer les deps qui cassent l'install (torchopenl3 -> resampy 0.2, cdpam, pesq, wget, setuptools fixe)
to_remove = [
    '"torchopenl3",',
    '"cdpam",',
    '"wget",',
    '"pesq",',
    '"setuptools==58.2.0"',
]
for s in to_remove:
    content = content.replace(s, "")
# Nettoyer les virgules en trop (double virgule ou virgule avant )
content = content.replace(", ,", ",")
content = content.replace(", ]", "]")
content = content.replace(",  ]", "]")

with open(setup_py, "w") as f:
    f.write(content)
print("setup.py patché (torchopenl3, cdpam, pesq, wget, setuptools retirés)")
print("Tu peux relancer: pip install --pre -e .")
