begin;
create table public.lrc_products (code text primary key check (code ~ '^LRC-[A-Z0-9]+(-[A-Z0-9]+)+$'), is_visible boolean not null default false, sort_order integer not null default 0 check (sort_order >= 0), content jsonb not null check (jsonb_typeof(content) = 'object' and content ?& array['title','specs','description','retailPriceEuro','basePriceEuro','basePriceDate','photos'] and jsonb_typeof(content->'photos') = 'array'));
alter table public.lrc_products enable row level security;
revoke all on public.lrc_products from anon, authenticated;
grant select on public.lrc_products to anon, authenticated;
grant insert, update on public.lrc_products to authenticated;
create policy "Read visible LRC products" on public.lrc_products for select to anon, authenticated using (is_visible);
create policy "Admins read all LRC products" on public.lrc_products for select to authenticated using ((select public.is_admin()) is true);
create policy "Admins add LRC products" on public.lrc_products for insert to authenticated with check ((select public.is_admin()) is true);
create policy "Admins update LRC products" on public.lrc_products for update to authenticated using ((select public.is_admin()) is true) with check ((select public.is_admin()) is true);
insert into public.lrc_products (code,is_visible,sort_order,content) values
('LRC-BAB-03',true,1,$product${
  "retailPriceEuro": 25,
  "basePriceEuro": 25,
  "basePriceDate": "10. 9. 2026.",
  "title": {
    "hr": "Personalizirana kutija uspomena za bebe",
    "en": "Personalized baby memory box"
  },
  "specs": {
    "hr": "350 × 110 × 112 mm · bijeli MDF, 3 mm",
    "en": "350 × 110 × 112 mm · white MDF, 3 mm"
  },
  "description": {
    "hr": "Kutija s unutarnjim pregradama i prigodnom gravurom s imenom i podacima o rođenju, prema želji kupca. U nju, primjerice, stanu dva bodija veličine 3–6 mjeseci, mala igračka i prve cipelice. Kutija se prodaje prazna, a uspomene koje ćeš u nju staviti biraš samostalno.",
    "en": "A box with interior dividers and an engraving of the name and birth details, as you wish. It can hold, for example, two bodysuits in size 3–6 months, a small toy, and the first shoes. The box is sold empty, and you choose the keepsakes yourself."
  },
  "photos": [
    {
      "src": "/lrc_image/proizvodi/slike/lrc-bab-03-01-zatvorena.webp",
      "alt": {
        "hr": "Zatvorena bijela kutija uspomena za bebe s motivom medvjedića i oglednim imenom Lana",
        "en": "Closed white baby memory box with a teddy-bear motif and the sample name Lana"
      },
      "caption": {
        "hr": "Ogledni prikaz s izmišljenim podacima.",
        "en": "Sample view with fictional details."
      },
      "frame": "#cec0bc"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-bab-03-02-primjer-sadrzaja.webp",
      "alt": {
        "hr": "Otvorena kutija s pregradama, dvama bodijima, plišanom igračkom i prvim cipelicama",
        "en": "Open box with dividers, two bodysuits, a plush toy, and first shoes"
      },
      "caption": {
        "hr": "Primjer korištenja. Kutija se prodaje prazna. Prikazana odjeća, igračka i cipelice nisu uključene u cijenu.",
        "en": "Example of use. The box is sold empty. The clothing, toy, and shoes shown are not included in the price."
      },
      "frame": "#d3c2bc"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-bab-03-03-primjer-za-djecaka.webp",
      "alt": {
        "hr": "Zatvorena kutija snimljena sprijeda, s motivom medvjedića i oglednim imenom Lovro",
        "en": "Closed box photographed from the front, with a teddy-bear motif and the sample name Lovro"
      },
      "caption": {
        "hr": "Ogledni prikaz s izmišljenim podacima.",
        "en": "Sample view with fictional details."
      },
      "frame": "#d8c6c2"
    }
  ]
}$product$::jsonb),
('LRC-VIN-02',true,2,$product${
  "retailPriceEuro": 25,
  "basePriceEuro": 25,
  "basePriceDate": "10. 9. 2026.",
  "title": {
    "hr": "Personalizirana poklon kutija za bocu od 0,75 l",
    "en": "Personalized gift box for a 0.75 L bottle"
  },
  "specs": {
    "hr": "350 × 110 × 112 mm · bijeli MDF, 3 mm",
    "en": "350 × 110 × 112 mm · white MDF, 3 mm"
  },
  "description": {
    "hr": "Poklon kutija s kliznim poklopcem za jednu bocu od 0,75 l odgovarajućeg oblika. U cijenu je uključena gravura po želji. Na poklopac možemo ugravirati portret prema tvojoj fotografiji, posvetu ili oboje. Boca nije uključena.",
    "en": "A gift box with a sliding lid for one 0.75 L bottle of a suitable shape. Engraving to your wishes is included. We can engrave a portrait from your photo, a dedication, or both on the lid. The bottle is not included."
  },
  "photos": [
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-02-03-digitalni-primjer-gravure.webp",
      "alt": {
        "hr": "Digitalni primjer gravure portreta para i posvete na poklopcu",
        "en": "Digital example of an engraved couple portrait and dedication on the lid"
      },
      "caption": {
        "hr": "Digitalni primjer gravure portreta prema fotografiji.",
        "en": "Digital example of a portrait engraving from a photograph."
      },
      "frame": "#cab5aa"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-02-01-zatvorena.webp",
      "alt": {
        "hr": "Zatvorena bijela poklon kutija za bocu od 0,75 l s kliznim poklopcem i ručkom",
        "en": "Closed white gift box for a 0.75 L bottle, with a sliding lid and a handle"
      },
      "caption": {
        "hr": "",
        "en": ""
      },
      "frame": "#cbb8ae"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-02-02-unutrasnjost.webp",
      "alt": {
        "hr": "Otvorena prazna kutija od 0,75 l s vidljivim držačima za bocu",
        "en": "Open empty 0.75 L box with the bottle holders visible"
      },
      "caption": {
        "hr": "",
        "en": ""
      },
      "frame": "#cdb9ae"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-usporedba-05-i-075.webp",
      "alt": {
        "hr": "Dvije bijele kutije za boce, manja lijevo i veća desno",
        "en": "Two white bottle boxes, the smaller on the left and the larger on the right"
      },
      "caption": {
        "hr": "Lijevo kutija za bocu od 0,5 l, desno kutija za bocu od 0,75 l.",
        "en": "Left: box for a 0.5 L bottle. Right: box for a 0.75 L bottle."
      },
      "frame": "#c4b1a8"
    }
  ]
}$product$::jsonb),
('LRC-VIN-03',true,3,$product${
  "retailPriceEuro": 22,
  "basePriceEuro": 22,
  "basePriceDate": "1. 11. 2026.",
  "title": {
    "hr": "Personalizirana poklon kutija za bocu likera od 0,5 l",
    "en": "Personalized gift box for a 0.5 L liqueur bottle"
  },
  "specs": {
    "hr": "250 × 110 × 112 mm · bijeli MDF, 3 mm",
    "en": "250 × 110 × 112 mm · white MDF, 3 mm"
  },
  "description": {
    "hr": "Poklon kutija s kliznim poklopcem za jednu bocu likera od 0,5 l odgovarajućeg oblika, primjerice teranina. U cijenu je uključena gravura po želji. Boca nije uključena.",
    "en": "A gift box with a sliding lid for one 0.5 L liqueur bottle of a suitable shape, such as teranino. Engraving to your wishes is included. The bottle is not included."
  },
  "photos": [
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-03-03-digitalni-primjer-gravure.webp",
      "alt": {
        "hr": "Digitalni primjer gravure ženskog portreta i natpisa Sretan rođendan na manjoj kutiji",
        "en": "Digital example of an engraved female portrait and the words Happy birthday on the smaller box"
      },
      "caption": {
        "hr": "Digitalni primjer rođendanske gravure s izmišljenim portretom.",
        "en": "Digital example of a birthday engraving with a fictional portrait."
      },
      "frame": "#c8b5ae"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-03-01-zatvorena.webp",
      "alt": {
        "hr": "Zatvorena manja bijela poklon kutija za bocu likera od 0,5 l",
        "en": "Closed smaller white gift box for a 0.5 L liqueur bottle"
      },
      "caption": {
        "hr": "",
        "en": ""
      },
      "frame": "#c8b5ac"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-03-02-unutrasnjost.webp",
      "alt": {
        "hr": "Otvorena prazna manja kutija s podignutim poklopcem i držačem za bocu",
        "en": "Open empty smaller box with the lid raised and a bottle holder"
      },
      "caption": {
        "hr": "",
        "en": ""
      },
      "frame": "#cab3a8"
    },
    {
      "src": "/lrc_image/proizvodi/slike/lrc-vin-usporedba-05-i-075.webp",
      "alt": {
        "hr": "Dvije bijele kutije za boce, manja lijevo i veća desno",
        "en": "Two white bottle boxes, the smaller on the left and the larger on the right"
      },
      "caption": {
        "hr": "Lijevo kutija za bocu od 0,5 l, desno kutija za bocu od 0,75 l.",
        "en": "Left: box for a 0.5 L bottle. Right: box for a 0.75 L bottle."
      },
      "frame": "#c4b1a8"
    }
  ]
}$product$::jsonb);
commit;
