/**
 * Demo catalog for the quote module (TEST DATA): products modelled on the public product range of
 * dumanmadencilik.com (sepiolite grades, bentonite, calcite) with estimated specs, prices, options,
 * container/order services, delivery terms and watermarked test PDFs (TDS, SDS, CoA).
 *
 * Writes into <outDir>:  pdf/*.pdf · seed.sql (D1) · uploads.tsv (R2 key → file)
 * Run:  npx tsx scripts/seed-demo-catalog.ts <outDir>
 * Then: upload uploads.tsv with `wrangler r2 object put`, execute seed.sql with `wrangler d1 execute`.
 * Skips nothing by itself: run it only against a database without these slugs / option names.
 */
import fontkit from '@pdf-lib/fontkit';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const outDir = process.argv[2];
if (!outDir) throw new Error('usage: tsx scripts/seed-demo-catalog.ts <outDir>');
mkdirSync(join(outDir, 'pdf'), { recursive: true });

/* ───────────── Data ───────────── */

type Spec = { labelEn: string; labelTr: string; value: string; unit?: string };
type Pack = {
  type: 'bigbag' | 'pallet';
  nameEn: string;
  nameTr: string;
  net: number;
  gross: number;
  l: number;
  w: number;
  h: number;
  tiers: number;
  price: number; // cents per ton
};
type Opt = {
  nameEn: string;
  nameTr: string;
  shortEn: string;
  shortTr: string;
  longEn: string;
  longTr: string;
  group?: string;
  priceType: 'fixed' | 'per_unit' | 'per_ton' | 'per_container' | 'percent';
  amount: number;
  mandatory?: boolean;
  isDefault?: boolean;
};
type Product = {
  slug: string;
  file: string;
  nameEn: string;
  nameTr: string;
  descEn: string;
  descTr: string;
  hs: string;
  specs: Spec[];
  packs: Pack[];
  options: Opt[];
};

const NOTE_EN = 'Test data: values are indicative and based on public product information.';
const NOTE_TR = 'Test verisi: değerler tahminidir, açık ürün bilgisine dayanır.';

const coa: Opt = {
  nameEn: 'Certificate of analysis',
  nameTr: 'Analiz sertifikası',
  shortEn: 'Batch analysis issued by our laboratory for every line.',
  shortTr: 'Her satır için laboratuvarımızın düzenlediği parti analizi.',
  longEn:
    'Every shipment line is sampled during loading and analysed in our plant laboratory.\n\nThe certificate lists the parameters of the technical data sheet with the measured values and is sent with the shipping documents.',
  longTr:
    'Her sevkiyat satırından yükleme sırasında numune alınır ve tesis laboratuvarımızda analiz edilir.\n\nSertifika, teknik föydeki parametreleri ölçülen değerlerle birlikte verir ve sevk evrakıyla gönderilir.',
  priceType: 'fixed',
  amount: 2500,
  mandatory: true,
};
const dust: Opt = {
  nameEn: 'Dust removal',
  nameTr: 'Toz giderme',
  shortEn: 'Extra screening that removes fine particles before packing.',
  shortTr: 'Paketlemeden önce ince taneleri ayıran ek eleme.',
  longEn:
    'Granules pass an additional vibrating screen and air classifier before packing.\n\nRecommended for retail absorbents and any use where dust during handling must stay low.',
  longTr:
    'Granüller paketlemeden önce ek bir titreşimli elek ve hava sınıflandırıcıdan geçer.\n\nPerakende emici ürünler ve elleçlemede tozun düşük kalması gereken tüm kullanımlar için önerilir.',
  priceType: 'percent',
  amount: 250,
};
const drying: Opt = {
  nameEn: 'Extra drying (moisture max. 6 %)',
  nameTr: 'Ek kurutma (nem en fazla %6)',
  shortEn: 'Rotary dryer pass for a lower moisture limit.',
  shortTr: 'Daha düşük nem sınırı için döner kurutucu geçişi.',
  longEn:
    'Standard moisture is max. 8-10 %. With extra drying the product leaves the dryer at max. 6 %, which raises absorption capacity.\n\nUseful for oil and chemical spill absorbents.',
  longTr:
    'Standart nem en fazla %8-10’dur. Ek kurutma ile ürün kurutucudan en fazla %6 nemle çıkar; emme kapasitesi artar.\n\nYağ ve kimyasal döküntü emicileri için uygundur.',
  priceType: 'per_ton',
  amount: 1200,
};
const label: Opt = {
  nameEn: 'Private label bags',
  nameTr: 'Özel baskılı torba',
  shortEn: 'Bags printed with your brand (min. one container).',
  shortTr: 'Sizin markanızla basılı torbalar (en az bir konteyner).',
  longEn:
    'Paper or PP bags printed in up to 3 colours with your artwork. Artwork approval is needed before production.\n\nLead time adds about two weeks for the first order.',
  longTr:
    'Kâğıt ya da PP torbalar, tasarımınızla en fazla 3 renk basılır. Üretimden önce tasarım onayı gerekir.\n\nİlk siparişte termin yaklaşık iki hafta uzar.',
  priceType: 'per_ton',
  amount: 600,
};
const grain = (rows: [string, number, boolean?][], en = 'Grain size', tr = 'Tane boyutu'): Opt[] =>
  rows.map(([size, amount, def]) => ({
    nameEn: size,
    nameTr: size,
    shortEn: `Screened to ${size}.`,
    shortTr: `${size} aralığında elenmiş.`,
    longEn: `Granules are screened to the ${size} range; at least 90 % of the material falls inside the range.`,
    longTr: `Granüller ${size} aralığına elenir; malzemenin en az %90’ı bu aralıktadır.`,
    group: `${tr} / ${en}`,
    priceType: 'per_ton',
    amount,
    isDefault: def,
  }));

const sepSpecs = (colourEn: string, colourTr: string, content: string, extra: Spec[]): Spec[] => [
  { labelEn: 'Sepiolite content', labelTr: 'Sepiyolit içeriği', value: content, unit: '%' },
  { labelEn: 'Colour', labelTr: 'Renk', value: `${colourEn} / ${colourTr}` },
  ...extra,
  { labelEn: 'pH (10 % suspension)', labelTr: 'pH (%10 süspansiyon)', value: '8.5-9.5' },
];

const bigbag = (net: number, price: number, l = 95, h = 115, tiers = 2): Pack => ({
  type: 'bigbag',
  nameEn: `${net} kg Big Bag`,
  nameTr: `${net} kg Bigbag`,
  net,
  gross: net + 5,
  l: l * 10,
  w: l * 10,
  h: h * 10,
  tiers,
  price,
});
const pallet = (bags: number, bagKg: number, price: number, h = 140, tiers = 1): Pack => ({
  type: 'pallet',
  nameEn: `Pallet, ${bags} × ${bagKg} kg bags`,
  nameTr: `Palet, ${bags} × ${bagKg} kg torba`,
  net: bags * bagKg,
  gross: bags * bagKg + 25,
  l: 1200,
  w: 1000,
  h: h * 10,
  tiers,
  price,
});

const PRODUCTS: Product[] = [
  {
    slug: 'white-sepiolite-granules',
    file: 'White-Sepiolite-Granules',
    nameEn: 'White Sepiolite Granules',
    nameTr: 'Beyaz Sepiyolit Granül',
    descEn: `Selected white sepiolite grade in granular form for absorbent and carrier uses where a clean, light appearance matters. ${NOTE_EN}`,
    descTr: `Temiz ve açık renkli görünümün önemli olduğu emici ve taşıyıcı kullanımlar için seçilmiş beyaz sepiyolit, granül. ${NOTE_TR}`,
    hs: '2530.90',
    specs: sepSpecs('White', 'Beyaz', 'min. 80', [
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 8', unit: '%' },
      { labelEn: 'Bulk density', labelTr: 'Yığın yoğunluğu', value: '0.55-0.65', unit: 'g/cm³' },
      { labelEn: 'Water absorption', labelTr: 'Su emme', value: 'min. 120', unit: '%' },
      { labelEn: 'Oil absorption', labelTr: 'Yağ emme', value: 'min. 90', unit: '%' },
    ]),
    packs: [bigbag(600, 32000), pallet(40, 20, 33500)],
    options: [
      ...grain([['0.25-0.5 mm', 1500], ['0.5-1 mm', 0, true], ['1-2 mm', 0], ['2-4 mm', -500]]),
      dust,
      drying,
      label,
      coa,
    ],
  },
  {
    slug: 'white-sepiolite-powder',
    file: 'White-Sepiolite-Powder',
    nameEn: 'White Sepiolite Powder',
    nameTr: 'Beyaz Sepiyolit Toz',
    descEn: `Micronised white sepiolite for feed, premix and carrier formulations. ${NOTE_EN}`,
    descTr: `Yem, premiks ve taşıyıcı formülasyonlar için mikronize beyaz sepiyolit. ${NOTE_TR}`,
    hs: '2530.90',
    specs: sepSpecs('White', 'Beyaz', 'min. 80', [
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 8', unit: '%' },
      { labelEn: 'Passing 75 µm (200 mesh)', labelTr: '75 µm’den geçen (200 mesh)', value: 'min. 95', unit: '%' },
      { labelEn: 'Bulk density', labelTr: 'Yığın yoğunluğu', value: '0.35-0.45', unit: 'g/cm³' },
      { labelEn: 'Lead (Pb)', labelTr: 'Kurşun (Pb)', value: 'max. 10', unit: 'ppm' },
    ]),
    packs: [pallet(40, 20, 30500, 150), bigbag(500, 29000, 95, 115)],
    options: [
      ...grain([['200 mesh (75 µm)', 0, true], ['325 mesh (45 µm)', 2000]], 'Fineness', 'İncelik'),
      {
        nameEn: 'Feed additive compliance file',
        nameTr: 'Yem katkı uygunluk dosyası',
        shortEn: 'Documents for feed registration (E 562 sepiolitic clay).',
        shortTr: 'Yem kaydı için belgeler (E 562 sepiyolitik kil).',
        longEn:
          'Includes the heavy metal and dioxin analysis of the batch, the feed business registration of the plant and a declaration for E 562.\n\nRequired by most importers who use sepiolite in compound feed.',
        longTr:
          'Partinin ağır metal ve dioksin analizini, tesisin yem işletmesi kaydını ve E 562 beyanını içerir.\n\nSepiyoliti karma yemde kullanan çoğu ithalatçı ister.',
        priceType: 'fixed',
        amount: 3500,
      },
      label,
      coa,
    ],
  },
  {
    slug: 'brown-sepiolite-granules',
    file: 'Brown-Sepiolite-Granules',
    nameEn: 'Brown Sepiolite Granules',
    nameTr: 'Kahverengi Sepiyolit Granül',
    descEn: `Versatile brown sepiolite granules for spill control, industrial absorbents and carriers. ${NOTE_EN}`,
    descTr: `Döküntü kontrolü, endüstriyel emiciler ve taşıyıcılar için çok yönlü kahverengi sepiyolit granül. ${NOTE_TR}`,
    hs: '2530.90',
    specs: sepSpecs('Light brown', 'Açık kahverengi', 'min. 65', [
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 10', unit: '%' },
      { labelEn: 'Bulk density', labelTr: 'Yığın yoğunluğu', value: '0.60-0.70', unit: 'g/cm³' },
      { labelEn: 'Water absorption', labelTr: 'Su emme', value: 'min. 100', unit: '%' },
      { labelEn: 'Oil absorption', labelTr: 'Yağ emme', value: 'min. 75', unit: '%' },
    ]),
    packs: [bigbag(650, 21000), pallet(40, 20, 22500)],
    options: [
      ...grain([['0.5-1 mm', 0, true], ['1-2 mm', 0], ['2-4 mm', -500]]),
      dust,
      drying,
      label,
      coa,
    ],
  },
  {
    slug: 'brown-sepiolite-powder',
    file: 'Brown-Sepiolite-Powder',
    nameEn: 'Brown Sepiolite Powder',
    nameTr: 'Kahverengi Sepiyolit Toz',
    descEn: `Ground brown sepiolite for industrial carriers, binders and technical mixes. ${NOTE_EN}`,
    descTr: `Endüstriyel taşıyıcılar, bağlayıcılar ve teknik karışımlar için öğütülmüş kahverengi sepiyolit. ${NOTE_TR}`,
    hs: '2530.90',
    specs: sepSpecs('Light brown', 'Açık kahverengi', 'min. 65', [
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 10', unit: '%' },
      { labelEn: 'Passing 75 µm (200 mesh)', labelTr: '75 µm’den geçen (200 mesh)', value: 'min. 90', unit: '%' },
      { labelEn: 'Bulk density', labelTr: 'Yığın yoğunluğu', value: '0.40-0.50', unit: 'g/cm³' },
    ]),
    packs: [bigbag(600, 19000, 95, 115), pallet(40, 20, 20500, 150)],
    options: [...grain([['200 mesh (75 µm)', 0, true], ['325 mesh (45 µm)', 1800]], 'Fineness', 'İncelik'), label, coa],
  },
  {
    slug: 'dark-brown-sepiolite',
    file: 'Dark-Brown-Sepiolite',
    nameEn: 'Dark Brown Sepiolite (crushed)',
    nameTr: 'Koyu Kahverengi Sepiyolit (kırılmış)',
    descEn: `Function-first sepiolite grade, crushed, for industrial uses where appearance is secondary. ${NOTE_EN}`,
    descTr: `Görünümün ikinci planda olduğu endüstriyel kullanımlar için kırılmış, işlev öncelikli sepiyolit. ${NOTE_TR}`,
    hs: '2530.90',
    specs: sepSpecs('Dark brown', 'Koyu kahverengi', 'min. 55', [
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 15', unit: '%' },
      { labelEn: 'Particle size', labelTr: 'Tane boyutu', value: '0-10', unit: 'mm' },
      { labelEn: 'Bulk density', labelTr: 'Yığın yoğunluğu', value: '0.70-0.85', unit: 'g/cm³' },
    ]),
    packs: [bigbag(1000, 14000, 100, 115)],
    options: [...grain([['0-10 mm', 0, true], ['0-3 mm', 800]], 'Crushing size', 'Kırma boyutu'), coa],
  },
  {
    slug: 'foundry-bentonite',
    file: 'Foundry-Bentonite',
    nameEn: 'Foundry Bentonite',
    nameTr: 'Döküm Bentoniti',
    descEn: `Sodium-activated bentonite powder for green sand moulding systems. ${NOTE_EN}`,
    descTr: `Yaş kum kalıplama sistemleri için sodyum aktive bentonit tozu. ${NOTE_TR}`,
    hs: '2508.10',
    specs: [
      { labelEn: 'Montmorillonite content', labelTr: 'Montmorillonit içeriği', value: 'min. 75', unit: '%' },
      { labelEn: 'Swelling volume', labelTr: 'Şişme hacmi', value: 'min. 20', unit: 'ml/2 g' },
      { labelEn: 'Methylene blue value', labelTr: 'Metilen mavisi değeri', value: 'min. 350', unit: 'mg/g' },
      { labelEn: 'Green compression strength', labelTr: 'Yaş basma mukavemeti', value: 'min. 18', unit: 'N/cm²' },
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 12', unit: '%' },
      { labelEn: 'pH (5 % suspension)', labelTr: 'pH (%5 süspansiyon)', value: '9.0-10.5' },
    ],
    packs: [bigbag(1000, 12000, 90, 115), pallet(50, 25, 13200, 110, 2)],
    options: [
      {
        nameEn: 'Extra soda activation',
        nameTr: 'Ek soda aktivasyonu',
        shortEn: 'Higher sodium carbonate dosage for stronger green strength.',
        shortTr: 'Daha yüksek yaş mukavemet için artırılmış soda dozu.',
        longEn:
          'Sodium carbonate dosage is raised to suit high-pressure moulding lines.\n\nWe confirm the dosage with a sample from your sand system before production.',
        longTr:
          'Yüksek basınçlı kalıplama hatlarına uygun olarak sodyum karbonat dozu artırılır.\n\nÜretimden önce kum sisteminizden alınan numune ile doz teyit edilir.',
        priceType: 'per_ton',
        amount: 1500,
      },
      label,
      coa,
    ],
  },
  {
    slug: 'drilling-bentonite',
    file: 'Drilling-Bentonite',
    nameEn: 'Drilling Bentonite',
    nameTr: 'Sondaj Bentoniti',
    descEn: `Bentonite for water well and civil drilling muds, API 13A type values. ${NOTE_EN}`,
    descTr: `Su kuyusu ve inşaat sondaj çamurları için API 13A tipi değerlerde bentonit. ${NOTE_TR}`,
    hs: '2508.10',
    specs: [
      { labelEn: 'Viscometer reading at 600 rpm', labelTr: '600 rpm viskometre okuması', value: 'min. 30' },
      { labelEn: 'Yield point / plastic viscosity', labelTr: 'Akma noktası / plastik viskozite', value: 'max. 3' },
      { labelEn: 'Filtrate volume', labelTr: 'Filtrat hacmi', value: 'max. 15', unit: 'ml' },
      { labelEn: 'Residue on 75 µm', labelTr: '75 µm elek üstü', value: 'max. 4', unit: '%' },
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 10', unit: '%' },
    ],
    packs: [bigbag(1000, 13500, 90, 115), pallet(50, 25, 14800, 110, 2)],
    options: [
      {
        nameEn: 'API 13A test report',
        nameTr: 'API 13A test raporu',
        shortEn: 'Independent laboratory report to API 13A section 9.',
        shortTr: 'API 13A bölüm 9’a göre bağımsız laboratuvar raporu.',
        longEn:
          'A sample of the shipment is tested by an independent laboratory according to API Specification 13A, section 9.\n\nThe report is ready about ten days after loading.',
        longTr:
          'Sevkiyattan alınan numune bağımsız bir laboratuvarda API 13A bölüm 9’a göre test edilir.\n\nRapor yüklemeden yaklaşık on gün sonra hazır olur.',
        priceType: 'fixed',
        amount: 12000,
      },
      {
        nameEn: 'Polymer extended',
        nameTr: 'Polimer katkılı',
        shortEn: 'Polymer added for higher yield in fresh water.',
        shortTr: 'Tatlı suda daha yüksek verim için polimer katkısı.',
        longEn: 'A small polymer dosage increases mud yield, so less bentonite is needed per cubic metre of mud.',
        longTr: 'Düşük dozda polimer çamur verimini artırır; metreküp çamur başına daha az bentonit gerekir.',
        priceType: 'per_ton',
        amount: 2500,
      },
      coa,
    ],
  },
  {
    slug: 'bentonite-granules',
    file: 'Bentonite-Granules',
    nameEn: 'Bentonite Granules',
    nameTr: 'Bentonit Granül',
    descEn: `Clumping bentonite granules for absorbent and litter applications. ${NOTE_EN}`,
    descTr: `Emici ve kum uygulamaları için topaklanan bentonit granül. ${NOTE_TR}`,
    hs: '2508.10',
    specs: [
      { labelEn: 'Montmorillonite content', labelTr: 'Montmorillonit içeriği', value: 'min. 70', unit: '%' },
      { labelEn: 'Water absorption', labelTr: 'Su emme', value: 'min. 250', unit: '%' },
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 10', unit: '%' },
      { labelEn: 'Bulk density', labelTr: 'Yığın yoğunluğu', value: '0.85-0.95', unit: 'g/cm³' },
    ],
    packs: [bigbag(1000, 16000, 90, 115), pallet(40, 25, 17500, 120, 2)],
    options: [...grain([['0.5-2 mm', 0, true], ['1-4 mm', 0]]), dust, label, coa],
  },
  {
    slug: 'micronized-calcite',
    file: 'Micronized-Calcite',
    nameEn: 'Micronised Calcite',
    nameTr: 'Mikronize Kalsit',
    descEn: `High-whiteness ground calcite filler for plastics, paints, paper and adhesives. ${NOTE_EN}`,
    descTr: `Plastik, boya, kâğıt ve yapıştırıcılar için yüksek beyazlıkta öğütülmüş kalsit dolgu. ${NOTE_TR}`,
    hs: '2517.49',
    specs: [
      { labelEn: 'CaCO₃', labelTr: 'CaCO₃', value: 'min. 98.5', unit: '%' },
      { labelEn: 'Whiteness (Ry)', labelTr: 'Beyazlık (Ry)', value: 'min. 97' },
      { labelEn: 'Median particle size d50', labelTr: 'Ortalama tane boyu d50', value: '5', unit: 'µm' },
      { labelEn: 'Top cut d97', labelTr: 'Üst kesim d97', value: '20', unit: 'µm' },
      { labelEn: 'Fe₂O₃', labelTr: 'Fe₂O₃', value: 'max. 0.03', unit: '%' },
      { labelEn: 'Moisture', labelTr: 'Nem', value: 'max. 0.2', unit: '%' },
    ],
    packs: [bigbag(1000, 9500, 90, 110), pallet(40, 25, 10800, 120, 2)],
    options: [
      ...grain([['d50 2 µm', 2500], ['d50 5 µm', 0, true], ['d50 10 µm', -800]], 'Fineness', 'İncelik'),
      {
        nameEn: 'Stearic acid coating',
        nameTr: 'Stearik asit kaplama',
        shortEn: 'Surface-treated grade for PVC and polyolefin compounds.',
        shortTr: 'PVC ve poliolefin karışımları için yüzeyi işlenmiş kalite.',
        longEn:
          'Particles are coated with about 1 % stearic acid. Coating lowers oil absorption and improves dispersion in polymers.\n\nRecommended for PVC pipes, profiles and masterbatches.',
        longTr:
          'Taneler yaklaşık %1 stearik asitle kaplanır. Kaplama yağ emmeyi düşürür, polimer içinde dağılımı iyileştirir.\n\nPVC boru, profil ve masterbatch için önerilir.',
        priceType: 'per_ton',
        amount: 4500,
      },
      coa,
    ],
  },
  {
    slug: 'calcite-granules',
    file: 'Calcite-Granules',
    nameEn: 'Calcite Granules',
    nameTr: 'Kalsit Granül',
    descEn: `Low-iron calcite granules for construction chemicals, plasters and decorative uses. ${NOTE_EN}`,
    descTr: `Yapı kimyasalları, sıvalar ve dekoratif kullanımlar için düşük demirli kalsit granül. ${NOTE_TR}`,
    hs: '2517.49',
    specs: [
      { labelEn: 'CaCO₃', labelTr: 'CaCO₃', value: 'min. 98', unit: '%' },
      { labelEn: 'Whiteness (Ry)', labelTr: 'Beyazlık (Ry)', value: 'min. 94' },
      { labelEn: 'Fe₂O₃', labelTr: 'Fe₂O₃', value: 'max. 0.05', unit: '%' },
      { labelEn: 'Bulk density', labelTr: 'Yığın yoğunluğu', value: '1.40-1.55', unit: 'g/cm³' },
    ],
    packs: [bigbag(1000, 7000, 85, 100)],
    options: [...grain([['0.1-0.5 mm', 300], ['0.5-1.2 mm', 0, true], ['1.2-2.5 mm', 0]]), coa],
  },
];

const CONTAINER_OPTIONS: Opt[] = [
  {
    nameEn: 'Loading supervision',
    nameTr: 'Yükleme gözetimi',
    shortEn: 'Our staff supervises and photographs every loading.',
    shortTr: 'Her yüklemeyi ekibimiz gözetir ve fotoğraflar.',
    longEn:
      'A member of our logistics team attends the loading, checks unit count and seal number and sends a photo report the same day.',
    longTr:
      'Lojistik ekibimizden bir kişi yüklemede bulunur, birim sayısını ve mühür numarasını kontrol eder, aynı gün fotoğraflı rapor gönderir.',
    priceType: 'fixed',
    amount: 9000,
    mandatory: true,
  },
  {
    nameEn: 'Lashing and dunnage',
    nameTr: 'Sabitleme ve takoz',
    shortEn: 'Straps, airbags and wood to keep the load in place.',
    shortTr: 'Yükü yerinde tutan kayış, hava yastığı ve takoz.',
    longEn:
      'Recommended when the container is not full: the load is secured with straps, airbags and timber so it cannot shift during sea transport.',
    longTr:
      'Konteyner tam dolu değilse önerilir: yük deniz taşımasında kaymaması için kayış, hava yastığı ve kerestelerle sabitlenir.',
    priceType: 'fixed',
    amount: 6000,
    isDefault: true,
  },
  {
    nameEn: 'Desiccant bags',
    nameTr: 'Nem alıcı torbalar',
    shortEn: 'Absorbs condensation during long voyages.',
    shortTr: 'Uzun seferlerde yoğuşmayı emer.',
    longEn:
      'Desiccant strips are hung inside the container to prevent "container rain" that can wet bags on routes through different climate zones.',
    longTr:
      'Farklı iklim kuşaklarından geçen rotalarda torbaları ıslatabilen konteyner içi yoğuşmayı önlemek için nem alıcı şeritler asılır.',
    priceType: 'fixed',
    amount: 4500,
  },
  {
    nameEn: 'Fumigation',
    nameTr: 'Fümigasyon',
    shortEn: 'Pest control treatment with certificate.',
    shortTr: 'Sertifikalı haşere ilaçlaması.',
    longEn:
      'The loaded container is fumigated by a licensed company and a fumigation certificate is issued.\n\nRequired by several importing countries, mainly for wooden pallets and dunnage.',
    longTr:
      'Yüklenmiş konteyner lisanslı bir firma tarafından ilaçlanır ve fümigasyon sertifikası düzenlenir.\n\nBirçok ithalatçı ülke, özellikle ahşap palet ve takoz nedeniyle ister.',
    priceType: 'fixed',
    amount: 15000,
  },
  {
    nameEn: 'Kraft paper liner',
    nameTr: 'Kraft kâğıt kaplama',
    shortEn: 'Lines walls and floor to protect bags.',
    shortTr: 'Torbaları korumak için duvar ve tabanı kaplar.',
    longEn: 'Container walls and floor are lined with kraft paper so bags do not touch rough or damp surfaces.',
    longTr: 'Torbalar pürüzlü ya da nemli yüzeylere değmesin diye konteyner duvarları ve tabanı kraft kâğıtla kaplanır.',
    priceType: 'fixed',
    amount: 8000,
  },
  {
    nameEn: 'Cargo insurance',
    nameTr: 'Kargo sigortası',
    shortEn: 'Covers the goods value until the destination port.',
    shortTr: 'Mal bedelini varış limanına kadar teminat altına alır.',
    longEn:
      'Institute Cargo Clauses (A) cover for 110 % of the goods value. Most useful with FOB and EXW terms, where the risk passes to you early.',
    longTr:
      'Mal bedelinin %110’u için Institute Cargo Clauses (A) teminatı. Riskin size erken geçtiği FOB ve EXW teslimlerinde en çok işe yarar.',
    priceType: 'percent',
    amount: 50,
  },
];

const ORDER_OPTIONS: Opt[] = [
  {
    nameEn: 'Documentation',
    nameTr: 'Evrak hazırlığı',
    shortEn: 'Invoice, packing list and export declaration.',
    shortTr: 'Fatura, çeki listesi ve ihracat beyannamesi.',
    longEn: 'Commercial invoice, packing list, export customs declaration and shipping instructions for the whole order.',
    longTr: 'Tüm sipariş için ticari fatura, çeki listesi, ihracat gümrük beyannamesi ve yükleme talimatı.',
    priceType: 'fixed',
    amount: 7500,
    mandatory: true,
  },
  {
    nameEn: 'Certificate of origin',
    nameTr: 'Menşe şahadetnamesi',
    shortEn: 'Chamber of commerce certificate (EUR.1 or Form A on request).',
    shortTr: 'Ticaret odası belgesi (istenirse EUR.1 ya da Form A).',
    longEn:
      'Issued by the chamber of commerce for customs clearance at destination. EUR.1 or Form A can be issued instead when your country grants a reduced duty.',
    longTr:
      'Varış ülkesinde gümrükleme için ticaret odasınca düzenlenir. Ülkeniz indirimli gümrük uyguluyorsa yerine EUR.1 ya da Form A düzenlenebilir.',
    priceType: 'fixed',
    amount: 4000,
    isDefault: true,
  },
  {
    nameEn: 'Pre-shipment inspection (SGS)',
    nameTr: 'Yükleme öncesi gözetim (SGS)',
    shortEn: 'Independent quantity and quality inspection.',
    shortTr: 'Bağımsız miktar ve kalite gözetimi.',
    longEn:
      'SGS (or an inspector of your choice) samples the goods, checks quantity and marking and witnesses the loading.\n\nThe inspection certificate is issued before the bill of lading.',
    longTr:
      'SGS (ya da seçtiğiniz gözetim firması) numune alır, miktar ve işaretlemeyi kontrol eder, yüklemeye nezaret eder.\n\nGözetim belgesi konşimentodan önce düzenlenir.',
    priceType: 'fixed',
    amount: 45000,
  },
  {
    nameEn: 'Legalised documents',
    nameTr: 'Konsolosluk onaylı evrak',
    shortEn: 'Consular legalisation of invoice and certificate of origin.',
    shortTr: 'Fatura ve menşe şahadetnamesinin konsolosluk onayı.',
    longEn: 'Some importing countries require consular legalisation. Courier costs for the original documents are included.',
    longTr: 'Bazı ithalatçı ülkeler konsolosluk onayı ister. Asıl evrakın kurye bedeli dahildir.',
    priceType: 'fixed',
    amount: 15000,
  },
  {
    nameEn: 'Express loading (7 days)',
    nameTr: 'Hızlı yükleme (7 gün)',
    shortEn: 'Loading within 7 days of the advance payment.',
    shortTr: 'Peşinattan sonra 7 gün içinde yükleme.',
    longEn: 'Your order is moved ahead in the production plan. Standard lead time is 2-3 weeks.',
    longTr: 'Siparişiniz üretim planında öne alınır. Standart termin 2-3 haftadır.',
    priceType: 'per_container',
    amount: 10000,
  },
  {
    nameEn: 'Advance payment discount',
    nameTr: 'Peşin ödeme indirimi',
    shortEn: '2 % discount for 100 % payment before loading.',
    shortTr: 'Yüklemeden önce %100 ödemede %2 indirim.',
    longEn: 'Applies when the full amount is received by T/T before loading. Not combined with letter of credit terms.',
    longTr: 'Tutarın tamamı yüklemeden önce T/T ile alındığında geçerlidir. Akreditifli ödemeyle birlikte uygulanmaz.',
    priceType: 'percent',
    amount: -200,
  },
];

/* ───────────── SQL ───────────── */

const q = (s: string | null | undefined) => (s == null ? 'NULL' : `'${s.replace(/'/g, "''")}'`);
const b = (x: boolean | undefined) => (x ? 1 : 0);
const sql: string[] = [];

const optionCols =
  'name_en, name_tr, description_en, description_tr, long_description_en, long_description_tr, group_name, price_type, amount, is_mandatory, is_default, active, sort_order';
const optionVals = (o: Opt, i: number) =>
  [q(o.nameEn), q(o.nameTr), q(o.shortEn), q(o.shortTr), q(o.longEn), q(o.longTr), q(o.group ?? null), q(o.priceType), o.amount, b(o.mandatory), b(o.isDefault), 1, i * 10].join(', ');

PRODUCTS.forEach((p, pi) => {
  sql.push(
    `INSERT INTO products (slug, name_en, name_tr, description_en, description_tr, hs_code, specs, active, sort_order) VALUES (${[
      q(p.slug), q(p.nameEn), q(p.nameTr), q(p.descEn), q(p.descTr), q(p.hs), q(JSON.stringify(p.specs)), 1, (pi + 1) * 10,
    ].join(', ')});`,
  );
  const pid = `(SELECT id FROM products WHERE slug = ${q(p.slug)})`;
  p.packs.forEach((k, ki) =>
    sql.push(
      `INSERT INTO product_packagings (product_id, type, name_en, name_tr, net_weight_kg, gross_weight_kg, length_mm, width_mm, height_mm, max_tiers, allow_rotation, price_basis, price_cents, active, sort_order) VALUES (${[
        pid, q(k.type), q(k.nameEn), q(k.nameTr), k.net, k.gross, k.l, k.w, k.h, k.tiers, 1, q('per_ton'), k.price, 1, ki * 10,
      ].join(', ')});`,
    ),
  );
  p.options.forEach((o, oi) =>
    sql.push(`INSERT INTO product_options (product_id, ${optionCols}) VALUES (${pid}, ${optionVals(o, oi)});`),
  );
});
CONTAINER_OPTIONS.forEach((o, i) =>
  sql.push(`INSERT INTO container_options (container_type_id, ${optionCols}) VALUES (NULL, ${optionVals(o, i)});`),
);
ORDER_OPTIONS.forEach((o, i) => sql.push(`INSERT INTO order_options (${optionCols}) VALUES (${optionVals(o, i)});`));

// Delivery terms: fix the Turkish place name of the migrated term, add two more.
sql.push(
  `UPDATE delivery_terms SET place_tr = 'Mersin Limanı', notes_en = 'Loading port Mersin (MIP).', notes_tr = 'Yükleme limanı Mersin (MIP).', sort_order = 10, updated_at = unixepoch() WHERE incoterm = 'FOB' AND place_en = 'Mersin Port';`,
);
sql.push(
  `INSERT INTO delivery_terms (incoterm, place_en, place_tr, payment_terms_en, payment_terms_tr, notes_en, notes_tr, price_type, amount, active, sort_order) VALUES ('FOB', 'Izmir Port (Aliaga)', 'İzmir Limanı (Aliağa)', '30% advance by T/T, 70% against copy of B/L.', '%30 peşin (T/T), %70 konşimento kopyası karşılığı.', 'Longer inland haul from the plant than Mersin.', 'Tesisten Mersin’e göre daha uzun karayolu taşıması.', 'per_container', 12000, 1, 20);`,
);
sql.push(
  `INSERT INTO delivery_terms (incoterm, place_en, place_tr, payment_terms_en, payment_terms_tr, notes_en, notes_tr, price_type, amount, active, sort_order) VALUES ('EXW', 'Eskisehir plant', 'Eskişehir tesis', '100% advance by T/T before loading.', 'Yüklemeden önce %100 peşin (T/T).', 'Collected by your truck or forwarder at our plant; export clearance by the buyer.', 'Kamyonunuz ya da forwarder’ınız tesisimizden teslim alır; ihracat gümrüklemesi alıcıya aittir.', 'per_container', -25000, 1, 30);`,
);

/* ───────────── Test PDFs ───────────── */

const pub = (p: string) => readFileSync(join(process.cwd(), 'public', p));
const fontBytes = {
  regular: pub('fonts/pdf/OfferSans-Regular.ttf'),
  semibold: pub('fonts/pdf/OfferSans-SemiBold.ttf'),
  display: pub('fonts/pdf/OfferDisplay-Bold.ttf'),
};
const logo = pub('images/logo/logo-primary-400w.png');

const INK = rgb(0.11, 0.08, 0.06);
const STONE = rgb(0.48, 0.4, 0.32);
const GOLD = rgb(0.79, 0.57, 0.16);
const CREAM = rgb(0.97, 0.95, 0.93);

/** Replaces glyphs the subset fonts do not carry. */
function safe(font: PDFFont, s: string) {
  const set = new Set(font.getCharacterSet());
  const map: Record<string, string> = { '≤': '<=', '≥': '>=', '–': '-', '—': '-', '’': "'", '₂': '2', '₃': '3' };
  return [...s].map((ch) => (set.has(ch.codePointAt(0)!) ? ch : (map[ch] ?? '?'))).join('');
}

function measured(spec: Spec, seed: number): string {
  const v = spec.value;
  const num = (x: string) => Number(x.replace(',', '.'));
  const r = (x: number) => (Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
  const jitter = 0.9 + ((seed * 37) % 10) / 100;
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^max\. ([\d.]+)/))) return r(num(m[1]) * 0.75 * jitter);
  if ((m = v.match(/^min\. ([\d.]+)/))) {
    const lo = num(m[1]);
    // Percentages and whiteness near 100 stay below 100.
    return r(lo >= 90 && lo < 100 ? lo + (100 - lo) * (0.3 + ((seed * 7) % 4) / 10) : lo * (1.03 + ((seed * 13) % 5) / 100));
  }
  if ((m = v.match(/^([\d.]+)-([\d.]+)$/))) return r((num(m[1]) + num(m[2])) / 2);
  if (/^[\d.]+$/.test(v)) return r(num(v) * jitter);
  return 'Conforms';
}

type DocKind = { type: 'tds' | 'msds' | 'coa'; prefix: string; titleEn: string; titleTr: string };
const DOCS: DocKind[] = [
  { type: 'tds', prefix: 'TDS', titleEn: 'Technical Data Sheet', titleTr: 'Teknik Veri Föyü' },
  { type: 'msds', prefix: 'SDS', titleEn: 'Safety Data Sheet', titleTr: 'Güvenlik Bilgi Formu' },
  { type: 'coa', prefix: 'CoA', titleEn: 'Certificate of Analysis (sample)', titleTr: 'Analiz Sertifikası (örnek)' },
];

async function renderDoc(p: Product, d: DocKind, pi: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(fontBytes.regular, { subset: false });
  const semi = await doc.embedFont(fontBytes.semibold, { subset: false });
  const disp = await doc.embedFont(fontBytes.display, { subset: false });
  const img = await doc.embedPng(logo);
  doc.setTitle(`${d.prefix} ${p.nameEn} (TEST)`);
  doc.setAuthor('Sepiolite Mine');
  doc.setSubject('Test document for the quote module. Not for commercial use.');

  const page: PDFPage = doc.addPage([595.28, 841.89]);
  const M = 50;
  const W = 595.28 - 2 * M;
  let y = 841.89 - M;
  const text = (s: string, x: number, yy: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const f = o.font ?? reg;
    page.drawText(safe(f, s), { x, y: yy, font: f, size: o.size ?? 10, color: o.color ?? INK });
  };
  const wrap = (s: string, f: PDFFont, size: number, max: number) => {
    const out: string[] = [];
    let line = '';
    for (const w of safe(f, s).split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > max && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  const para = (s: string, o: { size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    for (const l of wrap(s, reg, o.size ?? 9.5, W)) {
      text(l, M, y, { size: o.size ?? 9.5, color: o.color });
      y -= (o.size ?? 9.5) * 1.45;
    }
  };

  // Watermark
  page.drawText('TEST DOCUMENT', {
    x: 120, y: 260, size: 64, font: semi, color: rgb(0.85, 0.2, 0.15), opacity: 0.09, rotate: degrees(40),
  });

  // Header
  const ld = img.scaleToFit(130, 40);
  page.drawImage(img, { x: M, y: y - ld.height, width: ld.width, height: ld.height });
  text('TEST / ÖRNEK BELGE', M + W - semi.widthOfTextAtSize('TEST / ÖRNEK BELGE', 9), y - 12, { font: semi, size: 9, color: rgb(0.7, 0.15, 0.1) });
  y -= ld.height + 26;
  text(d.titleEn, M, y, { font: disp, size: 22 });
  y -= 18;
  text(d.titleTr, M, y, { size: 11, color: STONE });
  y -= 26;
  page.drawRectangle({ x: M, y: y - 44, width: W, height: 52, color: CREAM });
  text(p.nameEn, M + 12, y - 8, { font: semi, size: 13 });
  text(`${p.nameTr} · HS ${p.hs}`, M + 12, y - 26, { size: 9.5, color: STONE });
  const no = `${d.prefix}-${String(pi + 1).padStart(2, '0')}-TEST`;
  text(no, M + W - 12 - reg.widthOfTextAtSize(no, 9), y - 8, { size: 9, color: STONE });
  y -= 70;

  if (d.type === 'msds') {
    const sections: [string, string][] = [
      ['1. Identification', `${p.nameEn}. Natural mineral, industrial use. Supplier: Sepiolite Mine, Ankara, Türkiye.`],
      ['2. Hazards identification', 'Not classified as hazardous under GHS / CLP. Fine dust may irritate eyes and the respiratory tract.'],
      ['3. Composition', `Natural mineral (${p.slug.includes('calcite') ? 'calcium carbonate' : p.slug.includes('bentonite') ? 'bentonite, montmorillonite' : 'sepiolite, hydrated magnesium silicate'}). May contain crystalline silica below 1 %.`],
      ['4. First aid', 'Eyes: rinse with water. Inhalation: move to fresh air. Skin: wash with water.'],
      ['5. Fire fighting', 'Non-flammable. Use extinguishing media suitable for the surroundings.'],
      ['6. Accidental release', 'Avoid raising dust. Collect mechanically or by vacuum.'],
      ['7. Handling and storage', 'Store dry, in closed bags. Avoid dust formation.'],
      ['8. Exposure controls', 'Respirable dust limit as per local regulation. Use a dust mask (FFP2) where dust is formed.'],
      ['9. Physical properties', `${p.specs.map((s) => `${s.labelEn}: ${s.value}${s.unit ? ` ${s.unit}` : ''}`).join('; ')}.`],
      ['10-16. Other information', 'Stable and non-reactive. No known toxicological or ecological effects. Not regulated for transport.'],
    ];
    for (const [h, body] of sections) {
      text(h, M, y, { font: semi, size: 10.5 });
      y -= 15;
      para(body);
      y -= 8;
    }
  } else {
    const isCoa = d.type === 'coa';
    if (isCoa) {
      para(`Batch: ${String(240000 + pi * 137)} · Sampling date: 2026-11-09 · Quantity represented: 24 t`, { color: STONE });
      y -= 8;
    } else {
      para(p.descEn);
      y -= 4;
      para(p.descTr, { color: STONE });
      y -= 10;
    }
    const cols = isCoa ? ['Parameter', 'Specification', 'Result', 'Method'] : ['Parameter', 'Parametre', 'Typical value'];
    const widths = isCoa ? [W * 0.36, W * 0.24, W * 0.18, W * 0.22] : [W * 0.36, W * 0.36, W * 0.28];
    const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, x) => a + x, 0));
    page.drawRectangle({ x: M, y: y - 6, width: W, height: 20, color: INK });
    cols.forEach((c, i) => text(c, xs[i] + 6, y, { font: semi, size: 9, color: rgb(1, 1, 1) }));
    y -= 22;
    p.specs.forEach((s, si) => {
      if (si % 2 === 1) page.drawRectangle({ x: M, y: y - 6, width: W, height: 18, color: CREAM });
      const spec = `${s.value}${s.unit ? ` ${s.unit}` : ''}`;
      const cells = isCoa
        ? [s.labelEn, spec, `${measured(s, si + pi)}${s.unit && measured(s, si + pi) !== 'Conforms' ? ` ${s.unit}` : ''}`, 'Internal lab']
        : [s.labelEn, s.labelTr, spec];
      cells.forEach((c, i) => text(c, xs[i] + 6, y, { size: 9 }));
      y -= 18;
    });
    y -= 14;
    if (isCoa) {
      para('Result: the batch conforms to the specification.', { size: 10 });
      y -= 30;
      page.drawLine({ start: { x: M + W - 180, y }, end: { x: M + W, y }, thickness: 0.6, color: STONE });
      text('Quality control (test signature)', M + W - 180, y - 12, { size: 8.5, color: STONE });
      y -= 30;
    } else {
      text('Packaging', M, y, { font: semi, size: 10.5 });
      y -= 15;
      for (const k of p.packs) para(`${k.nameEn}: net ${k.net} kg, ${k.l / 10} × ${k.w / 10} × ${k.h / 10} cm, stackable ${k.tiers} high.`);
      y -= 6;
      text('Applications', M, y, { font: semi, size: 10.5 });
      y -= 15;
      para('Values are typical and given for guidance; they do not constitute a specification. Suitability for a specific use should be confirmed by the buyer.');
    }
  }

  // Footer
  page.drawLine({ start: { x: M, y: M + 18 }, end: { x: M + W, y: M + 18 }, thickness: 0.5, color: GOLD });
  text('TEST DOCUMENT generated for the sepiolitemine.com quote module. Not for commercial use. Values are estimates.', M, M + 4, {
    size: 7.5,
    color: STONE,
  });
  return doc.save();
}

const uploads: string[] = [];
for (const [pi, p] of PRODUCTS.entries()) {
  for (const [di, d] of DOCS.entries()) {
    const bytes = await renderDoc(p, d, pi);
    const fileName = `${d.prefix}-${p.file}.pdf`;
    const path = join(outDir, 'pdf', fileName);
    writeFileSync(path, bytes);
    const key = `products/demo/${p.slug}/${crypto.randomUUID()}-${fileName}`;
    uploads.push(`${key}\t${path}`);
    sql.push(
      `INSERT INTO product_documents (product_id, doc_type, title_en, title_tr, r2_key, file_name, content_type, size_bytes, is_public, sort_order) VALUES ((SELECT id FROM products WHERE slug = ${q(p.slug)}), ${q(d.type)}, ${q(`${d.titleEn} (test)`)}, ${q(`${d.titleTr} (test)`)}, ${q(key)}, ${q(fileName)}, 'application/pdf', ${bytes.length}, 1, ${di * 10});`,
    );
  }
}

writeFileSync(join(outDir, 'seed.sql'), sql.join('\n') + '\n');
writeFileSync(join(outDir, 'uploads.tsv'), uploads.join('\n') + '\n');
console.log(`products ${PRODUCTS.length}, statements ${sql.length}, pdfs ${uploads.length}`);
