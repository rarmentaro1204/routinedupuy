RED='#E63329';BLUE='#152239'
def tbl(head,rows,cls=''):
    h=''.join(f'<th>{x}</th>' for x in head)
    r=''.join('<tr>'+''.join(f'<td>{c}</td>' for c in row)+'</tr>' for row in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table>'
def grp(img,label,head,rows):
    return f'<div class="grp"><div class="gl"><img src="img/{img}.png"><span>{label}</span></div>{tbl(head,rows)}</div>'
def page(title_it,title_en,body,section='Estrazione fumi · Fume extraction'):
    return f'''<section class="page"><header><div><h1>{title_it}</h1><p class="sub">{title_en}</p></div><div class="sec">Welding<br><small>{section}</small></div></header>{body}<footer>Dupuy · Via Enrico de Nicola 27 - 10036 Settimo Torinese (TO) · Tel. +39 011 8975444 · info@dupuy.it</footer></section>'''
CD=['Codice · Code','Descrizione · Description']
def codes(prefix,items,desc):
    return [[c,desc.format(*d)] for c,d in items]

# page 1 Techflex
p1=f'''<div class="cols"><div><img class="hero" src="img/hero.png"></div><div>
<dl><dt>Impiego · Use</dt><dd>Aspirazione fumi e micropolveri di saldatura<br><em>Welding fume and fine dust extraction</em></dd>
<dt>Costruzione · Build</dt><dd>Acciaio e lega di alluminio<br><em>Steel and aluminium alloy</em></dd>
<dt>Applicazioni · Applications</dt><dd><img class="apps" src="img/apps.png"></dd></dl></div></div>
<div class="cols3"><div><h3>Caratteristiche · Features</h3><p>Il braccio TECHFLEX, grazie ai materiali utilizzati e all'innovativo progetto, permette all'operatore di poter contare su un'elevata manovrabilità, un posizionamento stabile e un'eccezionale robustezza, garantiti dalla struttura a pantografo che sostiene il braccio. Le versioni da parete possono essere dotate di un aspiratore centrifugo e di una mensola a parete per il collegamento alla tubazione dell'impianto fumi. Le versioni da banco o carrello sono dotate di un apposito tronchetto rotante 360°. Non adatto per polveri o liquidi.</p>
<p class="en">Thanks to its materials and innovative design, the TECHFLEX arm offers high manoeuvrability, stable positioning and exceptional robustness, guaranteed by the pantograph structure supporting the arm. Wall versions can be fitted with a centrifugal fan and a wall bracket for connection to the fume system ducting. Bench or trolley versions have a dedicated 360° rotating stub. Not suitable for dusts or liquids.</p></div>
<div><h3>Struttura · Structure</h3><p>Struttura portante esterna in acciaio rinforzato per garantire resistenza e solidità nel tempo. Tubo rigido in alluminio per un'elevata leggerezza. Pistoni a gas per un posizionamento stabile. Cappa di aspirazione ad alta efficienza di captazione per la massima efficienza di aspirazione, completa di serranda manuale per la taratura della portata, griglia anti intrusione e maniglia. Su richiesta è disponibile il kit di illuminazione a led per la cappa. Possibilità di abbinare due bracci tramite apposita mensola.</p>
<p class="en">Reinforced steel external load-bearing structure for lasting strength. Rigid aluminium tube for light weight. Gas pistons for stable positioning. High-capture extraction hood with manual damper for flow adjustment, anti-intrusion grille and handle. LED lighting kit available on request. Two arms can be combined using a dedicated bracket.</p></div>
<div><h3>Versioni · Versions</h3><p><b>TECHFLEX T</b><br>Braccio articolato adatto per aspirazione fumi ad alta temperatura (max. 280 °C).<br><span class="en">Articulated arm for high-temperature fume extraction (max. 280 °C).</span></p><p><b>TECHFLEX ATEX</b><br>Braccio articolato idoneo per utilizzo in zona Atex CE Ex II 3GD 86 °C.<br><span class="en">Articulated arm suitable for use in ATEX zone CE Ex II 3GD 86 °C.</span></p><p>È possibile ordinare i bracci articolati pre-montati: con un piccolo sovrappresso si ottimizza in questo modo il tempo di installazione.<br><span class="en">Pre-assembled arms can be ordered: a small surcharge optimises installation time.</span></p></div></div>
<h2>Caratteristiche tecniche · Technical data</h2>'''
tech=[('TECHFLEX 100/1',100,1200,'400 - 600',650),('TECHFLEX 100/2',100,2000,'400 - 600',850),('TECHFLEX 100/3',100,3000,'400 - 600',850),('TECHFLEX 125/2',125,2000,'700 - 1000',800),('TECHFLEX 125/3',125,3000,'700 - 1000',800),('TECHFLEX 125/4',125,4000,'700 - 1000',800),('TECHFLEX 160/2',160,2000,'1000 - 1400',700),('TECHFLEX 160/3',160,3000,'1000 - 1400',700),('TECHFLEX 160/4',160,4000,'1000 - 1400',700)]
p1+=tbl(['Codice · Code','Diametro · Diameter (mm)','Lunghezza · Length (mm)','Portata · Flow (m³/h)','Perdita di carico media · Avg. pressure drop (Pa)'],[list(t) for t in tech],'num')
p1+='<h3 class="cert">Certificazioni · Certifications</h3><img class="cert" src="img/cert3.png">'

# page 2 models
def lst(prefix,d,l,code,kind,kind_en):
    return [[f'{prefix}{code}',f'Braccio TECHFLEX {kind} - Ø {d} mm - L. {l} mm <span class="en">· TECHFLEX {kind_en} arm</span>'] for d,l,code in []]
bench=[('100','b100',[('TECHFLEX100120',1200),('TECHFLEX100200',2000),('TECHFLEX100300',3000)]),('125','b125',[('TECHFLEX125200',2000),('TECHFLEX125300',3000),('TECHFLEX125400',4000)]),('160','b160',[('TECHFLEX160200',2000),('TECHFLEX160300',3000),('TECHFLEX160400',4000)])]
wall=[('100','w100',[('TECHFLEX100121',1200),('TECHFLEX100201',2000),('TECHFLEX100301',3000)]),('125','w125',[('TECHFLEX125201',2000),('TECHFLEX125301',3000),('TECHFLEX125401',4000)]),('160','w160',[('TECHFLEX160201',2000),('TECHFLEX160301',3000),('TECHFLEX160401',4000)])]
def blocks(lst,it,en):
    out=''
    for d,im,rows in lst:
        out+=grp(im,f'Ø {d} mm',CD,[[c,f'Braccio TECHFLEX {it} - Ø {d} mm - L. {l} mm<br><span class="en">TECHFLEX {en} arm - Ø {d} mm - L. {l} mm</span>'] for c,l in rows])
    return out
p2='<h2>Braccio TECHFLEX da banco/carrello · Bench/trolley arm</h2>'+blocks(bench,'da banco/carrello','bench/trolley')
p2w='<h2>Braccio TECHFLEX da parete · Wall arm</h2>'+blocks(wall,'da parete','wall')
p2b='<h2>Mensole di supporto · Support brackets</h2>'+grp('m1','Mensole per impianti centralizzati<br><span class="en">Brackets for central systems</span>',CD,[['CWB02018000100','Mensola per fissaggio a muro per connessione ad impianti centralizzati Ø 100 mm<br><span class="en">Wall bracket for connection to central systems Ø 100 mm</span>'],['CWB02018000000','Mensola per fissaggio a muro per connessione ad impianti centralizzati Ø 125-160 mm<br><span class="en">Wall bracket for connection to central systems Ø 125-160 mm</span>']])+grp('m2','Mensola per ventilatore<br><span class="en">Fan bracket</span>',CD,[['CWB020180EV000','Mensola per fissaggio a muro braccio articolato TECHFLEX Ø 125-160 mm per ventilatore EV<br><span class="en">Wall bracket for TECHFLEX articulated arm Ø 125-160 mm for EV fan</span>']])

# page 3 Techflex T
p3='<h2>Accessori · Accessories</h2><h3>Prolunga · Extension</h3>'+grp('pab1','PAB1 prolunga a bandiera per bracci<br><span class="en">PAB1 flag extension for arms</span>',CD,[[f'PAB1600000{n}000',f'Prolunga a bandiera PAB 1 per braccio con predisposizione per aspiratore EV18 o collarino per tubazione flessibile Ø 160 mm - L. {n}000 mm<br><span class="en">PAB 1 flag extension, prepared for EV18 fan or flexible-hose collar Ø 160 mm - L. {n}000 mm</span>'] for n in '12345'])
p3+='<h3>Aspiratori · Fans</h3>'+grp('rp','Aspiratore per gas ad alte temperature*<br><span class="en">High-temperature gas fan*</span>',CD,[['RP031020220TGC','Ventilatore RP 310/2 2.2KW 400V 50HZ - Versione gas caldi 300 °C - Per un braccio TECHFLEX T<br><span class="en">RP 310/2 fan, hot-gas version 300 °C - for one TECHFLEX T arm</span>'],['RP035020300TGC','Ventilatore RP 350/2 3.0KW 400V 50HZ - Versione gas caldi 300 °C - Per due bracci TECHFLEX T<br><span class="en">RP 350/2 fan, hot-gas version 300 °C - for two TECHFLEX T arms</span>']])+'<p class="note">* Altri modelli a richiesta · Other models on request</p>'
p3+='<h2>Ricambi · Spare parts</h2><h3>Tubazioni · Ducting</h3>'+grp('t36','T36 tubo flessibile alta temperatura per TECHFLEX T<br><span class="en">T36 high-temperature flexible hose for TECHFLEX T</span>',CD,[[c,f'Tubazione flessibile T36 alta temperatura Ø {d} mm - L. {l} m<br><span class="en">T36 high-temperature flexible hose Ø {d} mm - L. {l} m</span>'] for c,d,l in [('DBT36125045',125,'0,45'),('DBT36125090',125,'0,90'),('DBT36160045',160,'0,45'),('DBT36160090',160,'0,90')]])
p3+='<h3>Cappe di aspirazione · Extraction hoods</h3>'+grp('cappa','Cappe di aspirazione per TECHFLEX T<br><span class="en">Extraction hoods for TECHFLEX T</span>',CD,[['DBCAPPA125INOX','Cappa di aspirazione troncoconica in acciaio inox Ø 125 mm<br><span class="en">Stainless-steel conical extraction hood Ø 125 mm</span>'],['DBCAPPA160INOX','Cappa di aspirazione troncoconica in acciaio inox Ø 160 mm<br><span class="en">Stainless-steel conical extraction hood Ø 160 mm</span>']])

# page 4 PAB description
p4='''<div class="cols"><div><img class="hero" src="img/pabhero.png"></div><div><dl><dt>Impiego · Use</dt><dd>Aspirazione fumi e micropolveri di saldatura<br><em>Welding fume and fine dust extraction</em></dd><dt>Costruzione · Build</dt><dd>Acciaio verniciato di forte spessore<br><em>Thick painted steel</em></dd><dt>Applicazioni · Applications</dt><dd>Bracci articolati<br><em>Articulated arms</em></dd></dl></div></div>
<div class="cols3"><div><h3>Caratteristiche · Features</h3><p>Le prolunghe della serie PAB grazie all'elevata robustezza sono la soluzione ideale per aumentare il raggio di azione dei bracci articolati nei Ø 125, 160 e 200 mm. Il giunto sulla staffa a parete consente una rotazione di 180° mentre quello centrale di 360° per un'elevata copertura dell'area di lavoro del braccio.</p><p class="en">Thanks to their high robustness, PAB series extensions are the ideal solution for increasing the reach of articulated arms in Ø 125, 160 and 200 mm. The joint on the wall bracket allows 180° rotation, the central joint 360°, for wide coverage of the arm's work area.</p></div>
<div><h3>Struttura · Structure</h3><p>Interamente costruite in acciaio verniciato di forte spessore, sono dotate di una mensola che permette una totale sicurezza e che può fare da sostegno per gli aspiratori della serie EV.</p><p class="en">Built entirely in thick painted steel, fitted with a bracket for total safety that can also support EV series fans.</p></div>
<div><h3>Versioni · Versions</h3><p><b>PAB 1</b>: prolunga a bandiera per braccio con Ø 100-125-160: con predisposizione per aspiratore EV18 o collarino per tubazione flessibile.<br><span class="en">Flag extension for arms Ø 100-125-160, prepared for EV18 fan or flexible-hose collar.</span></p><p><b>PAB 2</b>: prolunga a bandiera per braccio con Ø 200 mm: con predisposizione per aspiratore EV30 o collarino per tubazione flessibile.<br><span class="en">Flag extension for Ø 200 mm arms, prepared for EV30 fan or flexible-hose collar.</span></p></div></div>
<h2>PAB prolunga per bracci articolati di aspirazione · Extension for articulated extraction arms</h2><h3>Caratteristiche tecniche · Technical data</h3>'''
pt=[(f'PAB1600000{n}000',160,n*1000,1800,1000,w) for n,w in zip(range(1,6),[35,39,44,49,54])]+[(f'PAB2000000{n}000',200,n*1000,2500,1000,w) for n,w in zip(range(1,5),[43,49,56,62])]
p4+=tbl(['Codice · Code','Diametro · Diameter (mm)','Lunghezza · Length (mm)','Portata · Flow (m³/h)','Perdita di carico · Pressure drop (Pa)','Peso totale · Weight (kg)'],[list(t) for t in pt],'num')
p4+='<div class="cols"><div><h3>Certificazioni · Certifications</h3><img class="cert" src="img/cert1.png"></div><div><h3>Imballo · Packaging</h3><img class="box" src="img/box.png"><p class="note">160×80×105 cm - PAB 160/3</p></div></div>'

# page 5 PAB models
def pabrows(d,n):
    return [[f'PAB{d}0000{i}000'.replace('PAB1600000','PAB160000') ,'x'] for i in range(1,n+1)]
r160=[[f'PAB160000{i:02d}000'[:0]+f'PAB1600000{i}000',f'Prolunga per bracci articolati di aspirazione - Ø 160 mm - L. {i}000 mm<br><span class="en">Extension for articulated extraction arms - Ø 160 mm - L. {i}000 mm</span>'] for i in range(1,6)]
r200=[[f'PAB2000000{i}000',f'Prolunga per bracci articolati di aspirazione - Ø 200 mm - L. {i}000 mm<br><span class="en">Extension for articulated extraction arms - Ø 200 mm - L. {i}000 mm</span>'] for i in range(1,5)]
p5='<h2>Modelli · Models</h2>'+grp('arm_s','Ø 160 mm',CD,r160)+grp('arm_s2','Ø 200 mm',CD,r200)+'<h2>Accessori · Accessories</h2><h3>Adattamenti · Adaptations</h3>'+grp('coil','Adattamento con collegamenti equipotenziali<br><span class="en">Adaptation with equipotential connections</span>',CD,[['COM00136','Adattamento con collegamenti equipotenziali su PAB per braccio TECHFLEX ATEX<br><span class="en">Adaptation with equipotential connections on PAB for TECHFLEX ATEX arm</span>']])+'<h3>Tubazioni e raccordi · Ducting and fittings</h3>'+grp('icap','Kit collegamento per ICAP<br><span class="en">ICAP connection kit</span>',CD,[['ACCICAP200010','Kit collegamento prolunga PAB su ICAP<br><span class="en">PAB extension connection kit on ICAP</span>']])+grp('coll','Collarino per innesto tubo flessibile Ø 160 mm su mensola<br><span class="en">Collar for flexible hose Ø 160 mm on bracket</span>',CD,[['ACCIBS00000RF1','Adattatore per innesto tubo flessibile Ø 160 mm su mensola Ø 160 mm<br><span class="en">Flexible-hose adapter Ø 160 mm on Ø 160 mm bracket</span>']])+grp('adatt','Adattatore per ULTRAFLEX Ø 200 mm<br><span class="en">Adapter for ULTRAFLEX Ø 200 mm</span>',CD,[['ACCIBS00000RF2','Adattatore per innesto tubo flessibile Ø 200 mm su mensola Ø 200 mm<br><span class="en">Flexible-hose adapter Ø 200 mm on Ø 200 mm bracket</span>']])

pages=page('TECHFLEX','Braccio articolato per aspirazione fumi e micropolveri di saldatura<br>Articulated arm for welding fume and fine dust extraction',p1)
pages+=page('TECHFLEX','Modelli da banco/carrello · Bench/trolley models',p2)
pages+=page('TECHFLEX','Modelli da parete e mensole · Wall models and brackets',p2w+p2b)
pages+=page('TECHFLEX T','Braccio articolato da parete per alte temperature · High-temperature wall-mounted articulated arm',p3)
pages+=page('PAB','Prolunga per bracci articolati di aspirazione · Extension for articulated extraction arms',p4)
pages+=page('PAB','Prolunga per bracci articolati di aspirazione · Modelli e accessori · Models and accessories',p5)
css=f'''@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap');
@page{{size:A4;margin:0}}*{{box-sizing:border-box}}body{{margin:0;font-family:Cairo,Calibri,sans-serif;color:{BLUE};font-size:8.6pt;line-height:1.35}}
.page{{width:210mm;height:297mm;padding:0 14mm 16mm;position:relative;page-break-after:always;overflow:hidden;border-top:0}}
header{{margin:0 -14mm 6mm;padding:9mm 14mm 6mm;background:{BLUE};color:#fff;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3mm solid {RED}}}
h1{{margin:0;font-weight:800;font-size:26pt;line-height:1}}.sub{{margin:2mm 0 0;font-weight:700;font-size:8.5pt}}.sec{{text-align:right;font-weight:800;font-size:13pt;line-height:1.1}}.sec small{{font-weight:400;font-size:7.5pt;color:#fff}}
h2{{font-weight:800;font-size:11pt;color:{RED};text-transform:uppercase;margin:5mm 0 2mm;border-bottom:.3mm solid {BLUE};padding-bottom:1mm}}
h3{{font-weight:700;font-size:9pt;margin:3mm 0 1.5mm;color:{BLUE}}}h3.cert{{margin-top:5mm}}
.en,em{{color:#4a5870;font-style:normal;font-size:.92em}}p{{margin:0 0 2mm}}
.cols{{display:grid;grid-template-columns:1fr 1.3fr;gap:6mm;align-items:center}}.cols3{{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:4mm}}
img.hero{{width:100%;max-height:55mm;object-fit:contain}}img.apps{{height:9mm}}img.cert{{height:9mm}}img.box{{height:22mm}}
dl{{margin:0}}dt{{font-weight:800;color:{RED};font-size:9.5pt;margin-top:2mm}}dd{{margin:0}}
table{{width:100%;border-collapse:collapse;font-size:8pt}}th{{background:{BLUE};color:#fff;font-weight:700;text-align:left;padding:1.2mm 2mm;font-size:7.5pt}}td{{padding:1mm 2mm;border-bottom:.25mm solid #c9d0db}}
table.num td:not(:first-child),table.num th:not(:first-child){{text-align:center}}tbody tr:nth-child(even) td{{background:#f3f5f8}}
.grp{{display:grid;grid-template-columns:30mm 1fr;gap:4mm;margin-bottom:3mm;align-items:start}}.gl{{text-align:center;font-weight:700;font-size:7.5pt}}.gl img{{max-width:26mm;max-height:20mm;display:block;margin:0 auto 1mm}}
.note{{font-size:7.5pt;color:#4a5870}}
h2{{margin-top:3.5mm}}.cols3 p{{font-size:7.6pt;line-height:1.3}}.page{{padding-bottom:20mm}}td{{padding:.7mm 2mm}}.grp{{margin-bottom:2mm}}.gl img{{max-height:12mm}}.gl{{font-size:7pt!important;line-height:1.2}}img.hero{{max-height:48mm}}
footer{{position:absolute;left:0;right:0;bottom:0;background:{BLUE};color:#fff;font-size:7pt;padding:3mm 14mm;text-align:center}}'''
open('techflex_ultraflex.html','w').write(f'<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Techflex</title><style>{css}</style></head><body>{pages}</body></html>')
