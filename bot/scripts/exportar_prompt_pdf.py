# Genera un PDF legible con las instrucciones actuales del bot (prompt ya construido).
# Uso: python exportar_prompt_pdf.py <entrada.txt> <salida.pdf>
import re
import sys

from fpdf import FPDF

ENTRADA = sys.argv[1] if len(sys.argv) > 1 else "/tmp/prompt-actual.txt"
SALIDA = sys.argv[2] if len(sys.argv) > 2 else "instrucciones-bot.pdf"
FUENTE = "C:/Windows/Fonts/arial.ttf"
FUENTE_NEGRITA = "C:/Windows/Fonts/arialbd.ttf"


class PDF(FPDF):
    def footer(self):
        self.set_y(-12)
        self.set_font("arial", "", 8)
        self.set_text_color(120)
        self.cell(0, 8, f"Página {self.page_no()}/{{nb}}", align="C")


pdf = PDF(format="A4")
pdf.set_auto_page_break(auto=True, margin=18)
pdf.set_margins(16, 16, 16)
pdf.add_font("arial", "", FUENTE)
pdf.add_font("arial", "B", FUENTE_NEGRITA)
pdf.alias_nb_pages()
pdf.add_page()

# Portada simple
pdf.set_font("arial", "B", 16)
pdf.set_text_color(0)
pdf.cell(0, 10, "Instrucciones actuales del bot de WhatsApp", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("arial", "", 10)
pdf.set_text_color(90)
pdf.cell(0, 6, "Prompt del sistema con la configuración real ya aplicada (precios, dirección, modos).", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, "Documento para revisión: marque las correcciones y devuélvalo.", new_x="LMARGIN", new_y="NEXT")
pdf.ln(4)

texto = open(ENTRADA, encoding="utf-8").read()

# Limpieza: emojis (> U+FFFF), variant selectors y caracteres de ancho cero
# (U+200B/U+200C/U+FEFF) cuelgan o rompen el render del PDF.
INVISIBLES = {"​", "‌", "﻿"}
texto = "".join(
    c for c in texto
    if ord(c) <= 0xFFFF and c not in INVISIBLES and not (0xFE00 <= ord(c) <= 0xFE0F)
)

for linea in texto.split("\n"):
    linea = linea.rstrip()
    if linea.strip() == "---":
        pdf.ln(2)
        continue
    m = re.match(r"^(#{1,4})\s+(.*)$", linea)
    if m:
        nivel = len(m.group(1))
        titulo = m.group(2)
        pdf.ln(3 if nivel > 1 else 5)
        pdf.set_font("arial", "B", 14 if nivel == 1 else (12 if nivel == 2 else 11))
        pdf.set_text_color(15, 118, 110)
        pdf.multi_cell(0, 6, titulo, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0)
        continue
    if linea.strip() == "":
        pdf.ln(2)
        continue
    pdf.set_font("arial", "", 10)
    pdf.multi_cell(0, 5, linea, wrapmode="CHAR", new_x="LMARGIN", new_y="NEXT")

pdf.output(SALIDA)
print("PDF generado:", SALIDA)
