/* Obračunski modul kalkulatora uvoza vozila u BiH — odvojen od UI-a.
   Sve zakonske stope, kursevi i procjene nalaze se u CONFIG ispod. */
(function (root) {
  'use strict';

  var CONFIG = {
    lastReviewed: '2026-10',
    // Kursevi: KM za 1 jedinicu valute. EUR je fiksni (valutni odbor). Ostali su INFORMATIVNI i treba ih ažurirati prema kursnoj listi CBBiH.
    rates: {
      EUR: { km: 1.95583, fixed: true },
      KM: { km: 1, fixed: true },
      CHF: { km: 2.0807, fixed: false },
      GBP: { km: 2.2742, fixed: false },
      USD: { km: 1.7780, fixed: false },
      SEK: { km: 0.1778, fixed: false }
    },
    currencies: ['EUR', 'KM', 'CHF', 'GBP', 'USD', 'SEK'],
    // Procjena prijevoza do granice BiH (EUR). PROCJENA.
    countries: [
      { id: 'DE', name: 'Njemačka', transport: 600, primary: true },
      { id: 'AT', name: 'Austrija', transport: 450, primary: true },
      { id: 'CH', name: 'Švicarska', transport: 650, primary: true, currency: 'CHF' },
      { id: 'IT', name: 'Italija', transport: 550, primary: true },
      { id: 'SI', name: 'Slovenija', transport: 300, primary: true },
      { id: 'NL', name: 'Nizozemska', transport: 750, primary: true },
      { id: 'FR', name: 'Francuska', transport: 800, primary: true },
      { id: 'BE', name: 'Belgija', transport: 750 },
      { id: 'LU', name: 'Luksemburg', transport: 750 },
      { id: 'DK', name: 'Danska', transport: 900 },
      { id: 'SE', name: 'Švedska', transport: 1100, currency: 'SEK' },
      { id: 'NO', name: 'Norveška', transport: 1200 },
      { id: 'ES', name: 'Španija', transport: 1100 },
      { id: 'CZ', name: 'Češka', transport: 550 },
      { id: 'PL', name: 'Poljska', transport: 700 }
    ],
    // Porijeklo: preferencijalno = postoji sporazum (SSP s EU, FTA s EFTA). 'check' = moguće, traži provjeru.
    origins: [
      { id: 'EU', name: 'Evropska unija', pref: 'yes' },
      { id: 'EFTA', name: 'EFTA (Švicarska, Norveška, Island, Lihtenštajn)', pref: 'yes' },
      { id: 'TR', name: 'Turska', pref: 'check' },
      { id: 'CEFTA', name: 'CEFTA (Srbija, Crna Gora, S. Makedonija, Albanija, Moldavija)', pref: 'check' },
      { id: 'JP', name: 'Japan', pref: 'no' },
      { id: 'KR', name: 'Južna Koreja', pref: 'no' },
      { id: 'US', name: 'SAD', pref: 'no' },
      { id: 'CN', name: 'Kina', pref: 'no' },
      { id: 'OTHER', name: 'Druga zemlja', pref: 'no' },
      { id: 'UNKNOWN', name: 'Nepoznato', pref: 'unknown' }
    ],
    categories: [
      { id: 'M1', name: 'M1 – putničko vozilo' },
      { id: 'N1', name: 'N1 – lako teretno vozilo' },
      { id: 'L', name: 'Motocikl (L1–L3)' },
      { id: 'OTHER', name: 'Ostalo' }
    ],
    fuels: [
      { id: 'benzin', name: 'Benzin' }, { id: 'dizel', name: 'Dizel' },
      { id: 'benzin_hibrid', name: 'Benzin/hibrid' }, { id: 'dizel_hibrid', name: 'Dizel/hibrid' },
      { id: 'phev', name: 'Plug-in hibrid' }, { id: 'elektro', name: 'Električno vozilo' },
      { id: 'lpg', name: 'LPG/autogas' }, { id: 'cng', name: 'CNG' }, { id: 'ostalo', name: 'Ostalo' }
    ],
    euroNorms: [
      { id: '', name: 'Nepoznato', level: null }, { id: 'E1', name: 'Euro 1', level: 1 }, { id: 'E2', name: 'Euro 2', level: 2 },
      { id: 'E3', name: 'Euro 3', level: 3 }, { id: 'E4', name: 'Euro 4', level: 4 }, { id: 'E5', name: 'Euro 5', level: 5 },
      { id: 'E6', name: 'Euro 6', level: 6 }, { id: 'E6D', name: 'Euro 6d / 6d-TEMP', level: 6.5 }, { id: 'E7', name: 'Euro 7', level: 7 }
    ],
    // Minimalna Euro norma (Sl. glasnik BiH 23/19). PROPISANO za M1/N1.
    minEuro: { used: { M1: 5, N1: 5 }, 'new': { M1: 6, N1: 6 } },
    // Carinske stope (Carinska tarifa 2026). PROPISANO, osim N1 (neprovjereno za električna) i OTHER.
    duty: {
      M1: 0.15, M1_elektro: 0.05, N1: 0.15, L: 0.10, OTHER: 0.15,
      preferential: 0.00
    },
    // Privremena suspenzija/smanjenje carine za NOVA ekološka vozila (Sl. glasnik BiH 22/26). PROPISANO, vremenski ograničeno.
    ecoRules: [
      { validFrom: '2026-02-26', validTo: '2026-12-31', category: 'M1', fuels: ['elektro', 'cng', 'lpg'], rate: 0.00 },
      { validFrom: '2026-02-26', validTo: '2026-12-31', category: 'M1', fuels: ['benzin_hibrid', 'phev'], rate: 0.05 },
      { validFrom: '2026-02-26', validTo: '2026-12-31', category: 'N1', fuels: ['elektro', 'cng'], rate: 0.00 }
    ],
    vatRate: 0.17,
    vatBaseIncludesTerminal: true, // konzervativno; nije razriješeno iz primarnog izvora
    // Homologacija (Sl. glasnik BiH 50/22, s PDV-om). PROPISANO.
    homologation: { M1: { coc: 234.00, noCoc: 257.40 }, N1: { coc: 234.00, noCoc: 257.40 }, L: { coc: 140.40, noCoc: 163.80 } },
    terminal: { estimate: 20.00, official: 11.70 }, // 11,70 propisano za putničko vozilo; 20,00 procjena s uslugama terminala
    spediterDefault: 200.00, // PROCJENA — postaviti vlastitu cijenu usluge
    benefits: {
      invalid: { valueLimitKM: 45000, previousLimitKM: 30000, keepYears: 3, repeatYears: 5,
        note: 'Vijeće ministara BiH je u oktobru 2026. povećalo prag s 30.000 na 45.000 KM. Provjerite da li je izmjena stupila na snagu.' },
      povratnik: { keepMonths: 36, abroadMonths: 12, ownedMonths: 6, repeatYears: 5, homologationExempt: ['M1', 'N1', 'L'] }
    }
  };

  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

  function parseAmount(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim().replace(/\s/g, '');
    if (s === '') return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  function kmPer(cur, cfg) { var r = (cfg || CONFIG).rates[cur]; return r ? r.km : NaN; }
  function toKM(amount, cur, cfg) { return round2(amount * kmPer(cur, cfg)); }
  function convert(amount, from, to, cfg) { return round2(amount * kmPer(from, cfg) / kmPer(to, cfg)); }

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function isDateInRange(date, from, to) { return date >= from && date <= to; }

  function baseDutyRate(inp, cfg) {
    if (inp.category === 'M1' && inp.fuel === 'elektro') return { rate: cfg.duty.M1_elektro, source: 'Carinska tarifa 2026, 8703 80 (električni putnički automobili)' };
    if (inp.category === 'L') return { rate: cfg.duty.L, source: 'Carinska tarifa 2026, 8711 (motocikli)' };
    if (inp.category === 'N1') return { rate: cfg.duty.N1, source: 'Standardna stopa za N1 (orijentaciono, provjeriti tarifni broj)' };
    if (inp.category === 'OTHER') return { rate: cfg.duty.OTHER, source: 'Pretpostavljena standardna stopa — potreban poseban tarifni tretman' };
    return { rate: cfg.duty.M1, source: 'Carinska tarifa 2026, 8703 (putnički automobili)' };
  }

  function ecoRule(inp, cfg, today) {
    if (inp.condition !== 'new') return { eligible: false, reason: 'Povlastica važi isključivo za nova vozila.' };
    for (var i = 0; i < cfg.ecoRules.length; i++) {
      var r = cfg.ecoRules[i];
      if (r.category === inp.category && r.fuels.indexOf(inp.fuel) >= 0) {
        if (!isDateInRange(today, r.validFrom, r.validTo)) return { eligible: false, reason: 'Mjera važi od ' + r.validFrom + ' do ' + r.validTo + '.' };
        return { eligible: true, rate: r.rate, rule: r };
      }
    }
    return { eligible: false, reason: 'Kombinacija kategorije i goriva nije obuhvaćena važećom mjerom.' };
  }

  function preferentialStatus(inp, cfg) {
    if (inp.eur1 !== 'yes') return { applies: false, status: 'none' };
    var o = find(cfg.origins, inp.origin) || { pref: 'unknown' };
    if (o.pref === 'no') return { applies: false, status: 'invalidOrigin' };
    if (inp.category === 'OTHER') return { applies: false, status: 'otherCategory' };
    return { applies: true, status: o.pref === 'yes' ? 'ok' : 'check' };
  }

  var POV_EXPECTED = ['yes', 'yes', 'no', 'yes', 'yes', 'yes'];

  function benefitStatus(inp, cfg, priceKM) {
    var b = inp.benefit;
    if (!b) return { key: null, status: 'none' };
    if (b === 'invalid') {
      var iv = inp.invalid || {}, lim = parseAmount(iv.limit);
      if (lim === null || isNaN(lim)) lim = cfg.benefits.invalid.valueLimitKM;
      var withinLimit = iv.adapted === 'yes' || priceKM <= lim;
      var answers = [iv.level, iv.notUsed, iv.keep];
      if (inp.category !== 'M1') return { key: b, status: 'notEligible', reason: 'Oslobađanje se odnosi na putnički automobil (M1).', limit: lim, withinLimit: withinLimit };
      if (!withinLimit) return { key: b, status: 'notEligible', reason: 'Cijena vozila (' + fmt(priceKM) + ') prelazi limit od ' + fmt(lim) + ', a vozilo nije posebno prilagođeno.', limit: lim, withinLimit: false };
      if (answers.indexOf('no') >= 0) return { key: b, status: 'notEligible', reason: 'Jedan od uslova nije ispunjen.', limit: lim, withinLimit: true };
      if (answers.indexOf(undefined) >= 0 || answers.indexOf(null) >= 0 || answers.indexOf('') >= 0 || iv.adapted == null) return { key: b, status: 'incomplete', reason: 'Odgovorite na sva pitanja.', limit: lim, withinLimit: withinLimit };
      return { key: b, status: 'conditional', limit: lim, withinLimit: true, exempt: { duty: true, vat: true, homologation: false } };
    }
    if (b === 'povratnik') {
      var a = inp.povratnik || [];
      for (var i = 0; i < 6; i++) { if (a[i] && a[i] !== POV_EXPECTED[i]) return { key: b, status: 'notEligible', reason: 'Najmanje jedan uslov nije ispunjen — povratnička povlastica možda nije primjenjiva.', failed: i }; }
      for (var j = 0; j < 6; j++) { if (!a[j]) return { key: b, status: 'incomplete', reason: 'Odgovorite na svih šest pitanja.' }; }
      var homEx = cfg.benefits.povratnik.homologationExempt.indexOf(inp.category) >= 0;
      return { key: b, status: 'conditional', exempt: { duty: true, vat: true, homologation: homEx } };
    }
    if (b === 'eko') {
      var e = ecoRule(inp, cfg, inp.today || todayISO());
      if (!e.eligible) return { key: b, status: 'notEligible', reason: e.reason };
      return { key: b, status: 'conditional', ecoRate: e.rate, rule: e.rule };
    }
    return { key: null, status: 'none' };
  }

  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function fmt(v) {
    var n = round2(v || 0), neg = n < 0; n = Math.abs(n);
    var p = n.toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + p[0] + ',' + p[1] + ' KM';
  }

  // Osnovica PDV-a pri uvozu (Zakon o PDV-u BiH, čl. 21): carinska vrijednost + carina i druge dažbine + zavisni troškovi do prvog odredišta.
  function vatBase(customsValue, duty, terminal, extrasInVat, cfg) {
    var parts = [{ label: 'Carinska vrijednost', value: customsValue }, { label: 'Carina', value: duty }];
    if (cfg.vatBaseIncludesTerminal) parts.push({ label: 'Naknada carinskog terminala', value: terminal });
    if (extrasInVat) parts.push({ label: 'Zavisni troškovi (dodatni)', value: extrasInVat });
    var sum = 0; parts.forEach(function (p) { sum += p.value; });
    return { total: round2(sum), parts: parts };
  }

  function calculate(inp, cfgIn) {
    var cfg = cfgIn || CONFIG;
    var price = parseAmount(inp.price), transport = parseAmount(inp.transport), sped = parseAmount(inp.spediter);
    var errors = [], warnings = [], missing = [];
    if (price === null) errors.push('Unesite kupovnu cijenu.');
    else if (isNaN(price) || price <= 0) errors.push('Kupovna cijena mora biti pozitivan broj.');
    if (transport === null) transport = 0; else if (isNaN(transport)) { errors.push('Trošak prijevoza nije ispravan broj.'); transport = 0; }
    if (sped === null) sped = cfg.spediterDefault; else if (isNaN(sped)) { errors.push('Trošak špeditera nije ispravan broj.'); sped = cfg.spediterDefault; }
    if (!cfg.rates[inp.currency]) errors.push('Nepodržana valuta.');
    var validPrice = errors.length === 0 || !(price === null || isNaN(price) || price <= 0);
    var priceKM = validPrice && price > 0 ? toKM(price, inp.currency, cfg) : 0;
    var transportKM = toKM(transport, inp.transportCurrency || 'EUR', cfg);
    var customsValue = round2(priceKM + transportKM);

    var dr = baseDutyRate(inp, cfg), dutyRate = dr.rate, dutySource = dr.source;
    var pref = preferentialStatus(inp, cfg);
    if (pref.applies) { dutyRate = cfg.duty.preferential; dutySource = 'Preferencijalna stopa uz dokaz o porijeklu (SSP / EFTA)'; }
    if (pref.status === 'invalidOrigin') warnings.push('Odabrano porijeklo nema preferencijalni tretman — EUR.1 ne snižava carinu, primijenjena je standardna stopa.');
    if (pref.status === 'check') warnings.push('Preferencijalni tretman za odabrano porijeklo treba potvrditi kod carinskog organa.');
    if (pref.status === 'otherCategory') warnings.push('Za kategoriju „Ostalo“ preferencijalna stopa se ne pretpostavlja.');

    var ben = benefitStatus(inp, cfg, priceKM);
    var exempt = { duty: false, vat: false, homologation: false };
    if (ben.status === 'conditional') {
      if (ben.exempt) exempt = ben.exempt;
      if (ben.key === 'eko' && ben.ecoRate < dutyRate) { dutyRate = ben.ecoRate; dutySource = 'Privremena mjera za nova ekološka vozila (Sl. glasnik BiH 22/26), važi do ' + ben.rule.validTo; }
    }
    var duty = exempt.duty ? 0 : round2(customsValue * dutyRate);

    var homTable = cfg.homologation[inp.category];
    var homologation = 0, homNote = '';
    if (exempt.homologation) { homologation = 0; homNote = 'Izuzeće od homologacije za vozila koja se uvoze radi preseljenja (Pravilnik o homologaciji, čl. 8.).'; }
    else if (homTable) { homologation = inp.coc === 'yes' ? homTable.coc : homTable.noCoc; homNote = 'Ne uključuje troškove eventualnih posebnih ispitivanja.'; }
    else { homNote = 'Za ovu kategoriju iznos nije propisan cjenovnikom — nije uračunat.'; warnings.push('Homologacija za kategoriju „Ostalo“ nije uračunata.'); }

    var terminal = cfg.terminal.estimate;
    var extras = (inp.extras || []).map(function (x) { var a = parseAmount(x.amount); return { name: x.name || 'Dodatni trošak', amount: a && a > 0 ? round2(a) : 0, inVat: !!x.inVat, invalid: a !== null && (isNaN(a) || a < 0) }; });
    if (extras.some(function (x) { return x.invalid; })) errors.push('Neki dodatni trošak nije ispravan iznos.');
    var extrasTotal = round2(extras.reduce(function (s, x) { return s + x.amount; }, 0));
    var extrasInVat = round2(extras.reduce(function (s, x) { return s + (x.inVat ? x.amount : 0); }, 0));

    var vb = vatBase(customsValue, duty, terminal, extrasInVat, cfg);
    var vat = exempt.vat ? 0 : round2(vb.total * cfg.vatRate);
    sped = round2(sped);
    var importCosts = round2(duty + vat + homologation + terminal + sped + extrasTotal);
    var total = round2(priceKM + transportKM + importCosts);

    // Tehnički podaci i upozorenja
    if (!inp.year) missing.push('godište');
    if (!inp.fuel) missing.push('gorivo');
    if (!inp.euro) missing.push('Euro norma');
    if (!inp.origin || inp.origin === 'UNKNOWN') missing.push('zemlja porijekla');
    var y = parseInt(inp.year, 10), curYear = new Date().getFullYear();
    if (inp.year && (isNaN(y) || y < 1900 || y > curYear)) errors.push('Godište nije ispravno.');
    var en = find(cfg.euroNorms, inp.euro || '');
    var minE = (cfg.minEuro[inp.condition === 'new' ? 'new' : 'used'] || {})[inp.category];
    var euroBelow = !!(en && en.level !== null && minE && en.level < minE && inp.fuel !== 'elektro');
    if (euroBelow && !(ben.key === 'povratnik' && ben.status === 'conditional')) warnings.push('Vozilo je ispod minimalne norme Euro ' + minE + ' za ' + (inp.condition === 'new' ? 'nova' : 'korištena') + ' vozila kategorije ' + inp.category + ' — redovan uvoz možda nije moguć. Postoje izuzeci (npr. preseljenje, oldtimeri), provjerite prije kupovine.');
    if (inp.category === 'OTHER') warnings.push('Kategorija „Ostalo“ može zahtijevati poseban tarifni tretman — obračun je orijentacioni.');
    if (inp.category === 'N1') warnings.push('Carinska stopa za N1 je orijentaciona i zavisi od tarifnog broja vozila.');

    return {
      ok: errors.length === 0, errors: errors, warnings: warnings, missing: missing, incomplete: missing.length > 0,
      priceKM: priceKM, transportKM: transportKM, customsValue: customsValue,
      dutyRate: exempt.duty ? 0 : dutyRate, dutySource: exempt.duty ? 'Oslobođeno (uslovno)' : dutySource, duty: duty,
      vatBase: vb.total, vatBaseParts: vb.parts, vatRate: exempt.vat ? 0 : cfg.vatRate, vat: vat,
      homologation: homologation, homologationNote: homNote, terminal: terminal, terminalOfficial: cfg.terminal.official, spediter: sped,
      extras: extras, extrasTotal: extrasTotal, importCosts: importCosts, total: total,
      duties: round2(duty + vat), fees: round2(homologation + terminal + sped + extrasTotal),
      exempt: exempt, benefit: ben, preferential: pref, euroBelow: euroBelow
    };
  }

  function compareScenarios(inp, cfg) {
    cfg = cfg || CONFIG;
    var base = Object.assign({}, inp, { eur1: 'no', benefit: null });
    var s1 = calculate(base, cfg);
    var out = [{ key: 'std', label: 'Standardni uvoz bez dokaza o porijeklu', valid: true, res: s1 }];
    var withEur = Object.assign({}, inp, { eur1: 'yes', benefit: null });
    var s2 = calculate(withEur, cfg);
    out.push({ key: 'eur1', label: 'Uvoz s EUR.1 ili drugim dokazom o porijeklu', valid: s2.preferential.applies, reason: s2.preferential.applies ? '' : 'Nije primjenjivo za odabrano porijeklo ili kategoriju.', res: s2 });
    if (inp.benefit) {
      var s3 = calculate(inp, cfg);
      out.push({ key: 'ben', label: 'Uvoz uz odabranu povlasticu', valid: s3.benefit.status === 'conditional', reason: s3.benefit.reason || '', res: s3 });
    }
    out.forEach(function (s) {
      s.diff = round2(s.res.total - s1.total);
      var why = [];
      if (s.res.duty !== s1.duty) why.push('carina');
      if (s.res.vat !== s1.vat) why.push('PDV');
      if (s.res.homologation !== s1.homologation) why.push('homologacija');
      s.why = why;
    });
    return out;
  }

  // Lokalno parsiranje teksta oglasa (ne šalje se nigdje).
  var BRANDS = ['Volkswagen', 'VW', 'Audi', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Opel', 'Ford', 'Škoda', 'Skoda', 'Seat', 'Cupra', 'Renault', 'Peugeot', 'Citroën', 'Citroen', 'Dacia', 'Fiat', 'Alfa Romeo', 'Toyota', 'Honda', 'Mazda', 'Nissan', 'Hyundai', 'Kia', 'Volvo', 'Tesla', 'Porsche', 'Mini', 'Land Rover', 'Jaguar', 'Jeep', 'Mitsubishi', 'Suzuki', 'Subaru', 'Lexus', 'Smart', 'MG', 'BYD'];
  function parseAd(text) {
    var t = String(text || '').trim(), out = {}, found = [];
    if (!t) return { fields: out, found: found, message: 'Zalijepite tekst oglasa.' };
    if (/^https?:\/\/\S+$/i.test(t)) return { fields: out, found: found, urlOnly: true, message: 'Prepoznat je samo link. Sadržaj stranice oglasa ne možemo pročitati — kopirajte tekst oglasa (cijenu i tehničke podatke) i zalijepite ga ovdje.' };
    var m;
    m = t.match(/(€|EUR|CHF|Fr\.|£|GBP|\$|USD|SEK|kr|KM|BAM)\s?(\d{1,3}(?:[.\s']\d{3})+|\d{3,7})(?:[,.]\d{2})?|(\d{1,3}(?:[.\s']\d{3})+|\d{3,7})(?:[,.]-|[,.]\d{2})?\s?(€|EUR|CHF|Fr\.|£|GBP|\$|USD|SEK|kr|KM|BAM)/i);
    if (m) {
      var sym = (m[1] || m[4] || '').toUpperCase(), num = (m[2] || m[3] || '').replace(/[.\s']/g, '');
      var curMap = { '€': 'EUR', 'EUR': 'EUR', 'CHF': 'CHF', 'FR.': 'CHF', '£': 'GBP', 'GBP': 'GBP', '$': 'USD', 'USD': 'USD', 'SEK': 'SEK', 'KR': 'SEK', 'KM': 'KM', 'BAM': 'KM' };
      if (curMap[sym] && +num > 0) { out.price = num; out.currency = curMap[sym]; found.push('cijena'); }
    }
    m = t.match(/(?:EZ|Erstzulassung|godište|godiste|first registration|registriert|Baujahr|Bj\.?)\s*:?\s*(?:\d{1,2}[./])?((?:19|20)\d{2})/i);
    if (m) { out.year = m[1]; found.push('godište'); }
    for (var i = 0; i < BRANDS.length; i++) {
      var re = new RegExp('\\b' + BRANDS[i].replace(/[-]/g, '[- ]?') + '\\b\\s+([A-Za-z0-9\\-]+(?:\\s[A-Za-z0-9\\-]+)?)', 'i');
      var bm = t.match(re);
      if (bm) { out.brand = BRANDS[i] === 'VW' ? 'Volkswagen' : BRANDS[i].replace('Skoda', 'Škoda').replace('Citroen', 'Citroën'); out.model = bm[1].replace(/\s+(\d+[.,]\d|TDI|TSI|kW|PS).*$/i, '').trim(); found.push('marka'); if (out.model) found.push('model'); break; }
    }
    if (/plug-?in/i.test(t)) out.fuel = 'phev';
    else if (/\b(elektro|electric|električn|EV\b|BEV)/i.test(t)) out.fuel = 'elektro';
    else if (/hybrid|hibrid/i.test(t)) out.fuel = /diesel|dizel/i.test(t) ? 'dizel_hibrid' : 'benzin_hibrid';
    else if (/\bCNG\b|Erdgas/i.test(t)) out.fuel = 'cng';
    else if (/\bLPG\b|Autogas/i.test(t)) out.fuel = 'lpg';
    else if (/diesel|dizel|TDI|CDI|\bd\b|HDi|dCi|CRDi/i.test(t)) out.fuel = 'dizel';
    else if (/benzin|petrol|gasoline|TSI|TFSI/i.test(t)) out.fuel = 'benzin';
    if (out.fuel) found.push('gorivo');
    m = t.match(/(\d[.\s]?\d{3}|\d{3,4})\s?(?:ccm|cm³|cm3|cc)\b/i);
    if (m) { out.ccm = m[1].replace(/[.\s]/g, ''); found.push('kubikaža'); }
    m = t.match(/(\d{2,3})\s?kW/i);
    if (m) { out.kw = m[1]; found.push('snaga'); }
    else { m = t.match(/(\d{2,3})\s?(?:PS|KS|hp|CV)\b/i); if (m) { out.kw = String(Math.round(+m[1] / 1.35962)); found.push('snaga (iz KS)'); } }
    m = t.match(/Euro\s?-?\s?(6\s?d(?:-?TEMP)?|[1-7])/i);
    if (m) { var e = m[1].replace(/\s/g, '').toUpperCase(); out.euro = /^6D/.test(e) ? 'E6D' : 'E' + e; found.push('Euro norma'); }
    m = t.match(/(\d{2,3})\s?g\s?\/\s?km/i);
    if (m) { out.co2 = m[1]; found.push('CO₂'); }
    if (/\b(neu|novo|new|Neuwagen)\b/i.test(t) && !/gebraucht|polovn|used/i.test(t)) { out.condition = 'new'; found.push('stanje'); }
    else if (/gebraucht|polovn|used|Gebrauchtwagen|km\b/i.test(t)) { out.condition = 'used'; }
    return { fields: out, found: found, message: found.length ? 'Popunjeno: ' + found.join(', ') + '. Provjerite podatke prije nastavka.' : 'Nismo prepoznali pouzdane podatke. Unesite ih ručno.' };
  }

  var api = { CONFIG: CONFIG, round2: round2, parseAmount: parseAmount, toKM: toKM, convert: convert, kmPer: kmPer, calculate: calculate, compareScenarios: compareScenarios, parseAd: parseAd, ecoRule: ecoRule, fmt: fmt, vatBase: vatBase, todayISO: todayISO, POV_EXPECTED: POV_EXPECTED };
  root.UvozKalkulator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
