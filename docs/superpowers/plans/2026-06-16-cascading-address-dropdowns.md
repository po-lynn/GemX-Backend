# Cascading Address Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text State/Region and City inputs in the Address & Location section of UserForm with cascading `<select>` dropdowns, restricted to Myanmar (default), Thailand, and South Korea.

**Architecture:** A new static data file exports the 3-level country→state→cities map. Both `UserEditForm` and `UserCreateForm` derive `availableStates` and `availableCities` from that map based on the currently selected country/state, and render `<select>` elements instead of `<input>` elements. No API or DB changes needed.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `features/users/data/country-locations.ts` | **Create** | Static geographic data: country → state → cities |
| `features/users/components/UserForm.tsx` | **Modify** | Use cascading selects; restrict COUNTRIES; default create to Myanmar |

---

### Task 1: Create the geographic data file

**Files:**
- Create: `features/users/data/country-locations.ts`

- [ ] **Step 1: Create the file with the full data structure**

Create `features/users/data/country-locations.ts` with exactly this content:

```ts
export const COUNTRY_LOCATIONS: Record<string, Record<string, string[]>> = {
  Myanmar: {
    "Ayeyarwady Region": [
      "Pathein", "Hinthada", "Myaungmya", "Maubin", "Pyapon", "Danubyu",
      "Bogale", "Kyaiklat", "Wakema", "Pantanaw", "Myanaung", "Kyangin",
      "Zalun", "Ingabu", "Tharrawaddy", "Gyobingauk", "Okpo", "Thonze",
      "Letpadan", "Haeya", "Mawgyun"
    ],
    "Bago Region": [
      "Bago", "Pyay", "Toungoo", "Nyaunglebin", "Kyaukkyi", "Shwegyin",
      "Daik-U", "Waw", "Paukkhaung", "Paungde", "Monyo", "Nattalin",
      "Zigon", "Thanatpin", "Kyauktaga", "Phyu", "Oktwin", "Penwegon"
    ],
    "Chin State": [
      "Hakha", "Falam", "Mindat", "Tedim", "Matupi", "Paletwa", "Thantlang",
      "Kanpetlet", "Rezua", "Rihkhawdar"
    ],
    "Kachin State": [
      "Myitkyina", "Bhamo", "Mogaung", "Mohnyin", "Hopin", "Putao",
      "Shwegu", "Waingmaw", "Hpakant", "Chipwi", "Tanai", "Naungmun",
      "Tsawlaw", "Machanbaw", "Panwa"
    ],
    "Kayah State": [
      "Loikaw", "Hpruso", "Bawlakhe", "Mese", "Shadaw", "Demoso",
      "Pasaung", "Phruso", "Ywathit"
    ],
    "Kayin State": [
      "Hpa-An", "Myawaddy", "Kawkareik", "Kyainseikgyi", "Hlaingbwe",
      "Baw-Ga-Li", "Waw Lay", "Thandaunggyi", "Kamamaung"
    ],
    "Magway Region": [
      "Magway", "Pakokku", "Yenangyaung", "Chauk", "Minbu", "Gangaw",
      "Tilin", "Myothit", "Thayet", "Aunglan", "Natmauk", "Taungdwingyi",
      "Mindon", "Saw", "Pauk", "Myaing", "Seikphyu", "Yesagyo",
      "Kyaukpadaung", "Sinbaungwe", "Pwintbyu"
    ],
    "Mandalay Region": [
      "Mandalay", "Pyin Oo Lwin", "Meiktila", "Myingyan", "Kyaukse",
      "Nyaung-U", "Mogok", "Natogyi", "Mahlaing", "Wundwin", "Pyawbwe",
      "Tatkon", "Yamethin", "Amarapura", "Patheingyi", "Madaya",
      "Pyigyitagon", "Chanayethazan", "Chanmyathazi", "Aungmyaythazan"
    ],
    "Mon State": [
      "Mawlamyine", "Thaton", "Kyaikto", "Bilin", "Mudon", "Ye",
      "Chaungzon", "Thanbyuzayat", "Kyaikmaraw", "Paung", "Kawkareik",
      "Kyaikkami", "Lamaing"
    ],
    "Naypyidaw Union Territory": [
      "Naypyidaw", "Pyinmana", "Lewe", "Tatkon", "Zeyarthiri",
      "Dekkhinathiri", "Zabuthiri", "Ottarathiri", "Pobbathiri",
      "Oaktarathiri", "Thabase", "Oattara Thiri"
    ],
    "Rakhine State": [
      "Sittwe", "Kyaukphyu", "Thandwe", "Maungdaw", "Buthidaung",
      "Rathedaung", "Minbya", "Myebon", "Ann", "Gwa", "Mrauk-U",
      "Pauktaw", "Ramree", "Toungup", "Ponnagyun"
    ],
    "Sagaing Region": [
      "Monywa", "Shwebo", "Sagaing", "Kalay", "Tamu", "Kale", "Ye-U",
      "Khin-U", "Wetlet", "Kyunhla", "Budalin", "Pale", "Yinmabin",
      "Chaung-U", "Ayadaw", "Banmauk", "Katha", "Wuntho", "Pinlebu",
      "Kawlin", "Indaw", "Kyaukmyaung", "Tagaung", "Tigyaing",
      "Hkamti", "Lahe", "Nanyun"
    ],
    "Shan State": [
      "Taunggyi", "Lashio", "Kengtung", "Loilem", "Kyaukme", "Nyaungshwe",
      "Hopong", "Langkho", "Muse", "Namtu", "Laukkaing", "Hsipaw",
      "Pinlaung", "Pindaya", "Ywangan", "Aungban", "Kalaw", "Panglong",
      "Monghsat", "Mongton", "Kyethi", "Mong Hsu", "Namhsan",
      "Hseni", "Kunlong", "Tangyan", "Mongmit", "Namkham", "Kutkai"
    ],
    "Tanintharyi Region": [
      "Dawei", "Myeik", "Kawthaung", "Palaw", "Yebyu", "Thayetchaung",
      "Launglon", "Bokpyin", "Kyunsu", "Tanintharyi", "Htantabin"
    ],
    "Yangon Region": [
      "Yangon", "Thanlyin", "Kyauktan", "Twantay", "Taikkyi", "Htantabin",
      "Kawhmu", "Kungyangon", "Hmawbi", "Mingaladon", "Hlegu",
      "Hlaingthaya", "Shwepyitha", "Insein", "Dagon", "North Dagon",
      "South Dagon", "East Dagon", "Dagon Seikkan", "Mayangone",
      "Kamayut", "Sanchaung", "Tarmwe", "Bahan", "Lanmadaw", "Latha"
    ],
  },

  Thailand: {
    "Bangkok": [
      "Bang Rak", "Pathum Wan", "Silom", "Sathon", "Chatuchak", "Lat Phrao",
      "Min Buri", "Lat Krabang", "Nong Khaem", "Taling Chan", "Bang Khae",
      "Phasi Charoen", "Thon Buri", "Bang Phlat", "Khlong San",
      "Bang Kho Laem", "Yan Nawa", "Phra Khanong", "Watthana", "Khlong Toei",
      "Prawet", "Suan Luang", "Bang Na", "Saphan Sung", "Bueng Kum",
      "Lak Si", "Don Mueang", "Bang Khen", "Phra Nakhon", "Dusit"
    ],
    "Amnat Charoen": [
      "Amnat Charoen", "Chanuman", "Hua Taphan", "Khemarat", "Lue Amnat",
      "Pathum Ratchawongsa", "Phana", "Senangkhanikhom"
    ],
    "Ang Thong": [
      "Ang Thong", "Chaiyo", "Mueang Ang Thong", "Pa Mok", "Pho Thong",
      "Sawaeng Ha", "Wiset Chai Chan"
    ],
    "Bueng Kan": [
      "Bueng Kan", "Bung Khla", "Pak Khat", "Phon Charoen", "Seka",
      "Si Wilai", "So Phisai", "Bueng Khong Long"
    ],
    "Buri Ram": [
      "Buri Ram", "Ban Dan", "Ban Kruat", "Ban Mai Chaiyaphot", "Chaloem Phra Kiat",
      "Chamni", "Huai Rat", "Khaen Dong", "Khu Mueang", "Krasung",
      "Lahan Sai", "Lam Plai Mat", "Mueang Buri Ram", "Na Pho",
      "Nang Rong", "Non Suwan", "Nong Hong", "Nong Ki", "Pakham",
      "Phlapphla Chai", "Phutthaisong", "Prakhon Chai", "Satuek"
    ],
    "Chachoengsao": [
      "Chachoengsao", "Bang Khla", "Bang Nam Priao", "Bang Pakong",
      "Khlong Khuean", "Mueang Chachoengsao", "Phanom Sarakham",
      "Plaeng Yao", "Ratchasan", "Sanam Chai Khet", "Tha Takiap"
    ],
    "Chai Nat": [
      "Chai Nat", "Hankha", "Manorom", "Noen Kham", "Nong Mamong",
      "Sapphaya", "Sankhaburi", "Wat Sing"
    ],
    "Chaiyaphum": [
      "Chaiyaphum", "Ban Khwao", "Bamnet Narong", "Chatturat", "Kaeng Khro",
      "Kaset Sombun", "Khon San", "Khon Sawan", "Mueang Chaiyaphum",
      "Nong Bua Daeng", "Nong Bua Rawe", "Phu Khiao", "Sap Yai",
      "Thep Sathit"
    ],
    "Chanthaburi": [
      "Chanthaburi", "Kaeng Hang Maeo", "Khao Khitchakut", "Khlung",
      "Laem Sing", "Mueang Chanthaburi", "Na Yai Am", "Pong Nam Ron",
      "Soi Dao", "Tha Mai"
    ],
    "Chiang Mai": [
      "Chiang Mai", "Chiang Dao", "Chom Thong", "Doi Lo", "Doi Saket",
      "Doi Tao", "Fang", "Galyani Vadhana", "Hang Dong", "Hot",
      "Jomthong", "Mae Ai", "Mae Chaem", "Mae On", "Mae Rim",
      "Mae Taeng", "Mae Wang", "Mueang Chiang Mai", "Omkoi", "Phrao",
      "Samoeng", "San Kamphaeng", "San Pa Tong", "San Sai", "Sankamphaeng"
    ],
    "Chiang Rai": [
      "Chiang Rai", "Chiang Khong", "Chiang Saen", "Doi Luang",
      "Khun Tan", "Mae Chan", "Mae Fa Luang", "Mae Lao", "Mae Sai",
      "Mae Suai", "Mueang Chiang Rai", "Pa Daet", "Phan", "Phaya Mengrai",
      "Thoeng", "Wiang Chai", "Wiang Chiang Rung", "Wiang Kaen",
      "Wiang Pa Pao"
    ],
    "Chon Buri": [
      "Chon Buri", "Ban Bueng", "Bang Lamung", "Bo Thong", "Ko Chan",
      "Ko Si Chang", "Mueang Chon Buri", "Nong Yai", "Phan Thong",
      "Phanat Nikhom", "Sattahip", "Si Racha", "Pattaya"
    ],
    "Chumphon": [
      "Chumphon", "Lang Suan", "Lamae", "Mueang Chumphon", "Pathio",
      "Phato", "Sawi", "Tha Sae", "Thung Tako"
    ],
    "Kalasin": [
      "Kalasin", "Don Chan", "Huai Mek", "Huai Phueng", "Kham Muang",
      "Khao Wong", "Khong Chai", "Mueang Kalasin", "Na Khu", "Na Mon",
      "Nong Kung Si", "Rong Kham", "Sam Chai", "Sahatsakhan",
      "Somdet", "Tha Khantho", "Yang Talat"
    ],
    "Kamphaeng Phet": [
      "Kamphaeng Phet", "Bueng Samakkhi", "Khlong Khlung", "Khlong Lan",
      "Ko Samro", "Lan Krabue", "Mueang Kamphaeng Phet", "Nakhon Chum",
      "Pang Sila Thong", "Phran Kratai", "Sai Ngam", "Sai Thong National Park"
    ],
    "Kanchanaburi": [
      "Kanchanaburi", "Bo Phloi", "Dan Makham Tia", "Huai Krachao",
      "Lai Wo", "Mueang Kanchanaburi", "Nong Prue", "Phanom Thuan",
      "Sai Yok", "Sangkhla Buri", "Si Sawat", "Tha Maka", "Tha Muang",
      "Thong Pha Phum"
    ],
    "Khon Kaen": [
      "Khon Kaen", "Ban Fang", "Ban Haet", "Ban Phai", "Chum Phae",
      "Chonnabot", "Kranuan", "Mancha Khiri", "Mueang Khon Kaen",
      "Nam Phong", "Nong Na Kham", "Nong Rua", "Nong Song Hong",
      "Phu Pha Man", "Phu Wiang", "Phon", "Sam Sung", "Ubolratana",
      "Waeng Noi", "Waeng Yai"
    ],
    "Krabi": [
      "Krabi", "Ao Luek", "Ko Lanta", "Ko Phi Phi", "Mueang Krabi",
      "Nuea Khlong", "Plai Phraya"
    ],
    "Lampang": [
      "Lampang", "Chae Hom", "Ko Kha", "Mae Mo", "Mae Phrik",
      "Mae Tha", "Mueang Lampang", "Mueang Pan", "Ngao", "Sop Prap",
      "Thoen", "Wang Nuea"
    ],
    "Lamphun": [
      "Lamphun", "Ban Hong", "Ban Thi", "Li", "Mae Tha", "Mueang Lamphun",
      "Pa Sang", "Thung Hua Chang", "Wang Nua"
    ],
    "Loei": [
      "Loei", "Chiang Khan", "Dan Sai", "Erawan", "Mueang Loei",
      "Na Duang", "Na Haeo", "Nong Hin", "Pak Chom", "Pha Khao",
      "Phu Kradueng", "Phu Luang", "Phu Rua", "Tha Li", "Wang Saphung"
    ],
    "Lop Buri": [
      "Lop Buri", "Ban Mi", "Chai Badan", "Khok Charoen", "Khok Samrong",
      "Mueang Lop Buri", "Nong Muang", "Phatthana Nikhom", "Sa Bot",
      "Tha Luang", "Tha Wung"
    ],
    "Mae Hong Son": [
      "Mae Hong Son", "Khun Yuam", "Mae La Noi", "Mae Sariang",
      "Mueang Mae Hong Son", "Pai", "Pang Mapha", "Sop Moei"
    ],
    "Maha Sarakham": [
      "Maha Sarakham", "Borabue", "Chiang Yuen", "Chuen Chom",
      "Kantharawichai", "Kosum Phisai", "Mueang Maha Sarakham",
      "Na Chueak", "Na Dun", "Phayakkhaphum Phisai", "Wapi Pathum",
      "Yang Si Surat"
    ],
    "Mukdahan": [
      "Mukdahan", "Don Tan", "Dong Luang", "Khamcha-i", "Mueang Mukdahan",
      "Nikhom Kham Soi", "Nong Sung", "Wan Yai"
    ],
    "Nakhon Nayok": [
      "Nakhon Nayok", "Ban Na", "Mueang Nakhon Nayok", "Ongkharak", "Pak Phli"
    ],
    "Nakhon Pathom": [
      "Nakhon Pathom", "Bang Len", "Don Tum", "Kamphaeng Saen",
      "Mueang Nakhon Pathom", "Nakhon Chai Si", "Phutthamonthon", "Sam Phran"
    ],
    "Nakhon Phanom": [
      "Nakhon Phanom", "Ban Phaeng", "Mueang Nakhon Phanom", "Na Kae",
      "Na Thom", "Na Wa", "Phon Sawan", "Pla Pak", "Renu Nakhon",
      "Si Songkhram", "Tha Uthen", "That Phanom", "Wang Yang"
    ],
    "Nakhon Ratchasima": [
      "Nakhon Ratchasima", "Ban Lueam", "Bua Lai", "Bua Yai",
      "Chakkarat", "Chaloem Phra Kiat", "Chok Chai", "Chum Phuang",
      "Dan Khun Thot", "Huai Thalaeng", "Kaeng Sanam Nang", "Kham Sakae Saeng",
      "Kham Thale So", "Khong", "Khon Buri", "Lam Thamenchai",
      "Mueang Nakhon Ratchasima", "Mueang Yang", "Non Daeng", "Non Sung",
      "Nong Bun Mak", "Pak Chong", "Pak Thong Chai", "Phimai",
      "Prathai", "Sida", "Sikhio", "Soeng Sang", "Wang Nam Khiao"
    ],
    "Nakhon Sawan": [
      "Nakhon Sawan", "Ban Phraek", "Chum Ta Bong", "Khanu Woralaksaburi",
      "Krok Phra", "Lat Yao", "Mae Poen", "Mae Wong", "Mueang Nakhon Sawan",
      "Nong Bua", "Phaisali", "Phayuha Khiri", "Tak Fa"
    ],
    "Nakhon Si Thammarat": [
      "Nakhon Si Thammarat", "Bang Khan", "Chaloem Phra Kiat", "Cha-uat",
      "Chian Yai", "Hua Sai", "Khanom", "Lan Saka", "Mueang Nakhon Si Thammarat",
      "Na Bon", "Nopphitam", "Phipun", "Phra Phrom", "Phrom Khiri",
      "Ron Phibun", "Sichon", "Tham Phannara", "Thung Song", "Thung Yai"
    ],
    "Nan": [
      "Nan", "Ban Luang", "Bo Kluea", "Chaloem Phra Kiat", "Chat Trakan",
      "Mae Charim", "Mueang Nan", "Na Muen", "Na Noi", "Phu Phiang",
      "Pua", "Santi Suk", "Song Khwae", "Thung Chang", "Wiang Sa"
    ],
    "Narathiwat": [
      "Narathiwat", "Bacho", "Chanae", "Cho-airong", "Ji-ngstar",
      "Mueang Narathiwat", "Ra-ngae", "Rueso", "Si Sakhon",
      "Sukhirin", "Su-ngai Kolok", "Su-ngai Padi", "Tak Bai", "Waeng", "Yi-ngo"
    ],
    "Nong Bua Lam Phu": [
      "Nong Bua Lam Phu", "Mueang Nong Bua Lam Phu", "Na Klang",
      "Na Wang", "Non Sang", "Si Bun Rueang", "Suwannakhuha"
    ],
    "Nong Khai": [
      "Nong Khai", "Fao Rai", "Mueang Nong Khai", "Phon Phisai",
      "Rattanawapi", "Sa Khrai", "Sangkhom", "Si Chiang Mai",
      "Tha Bo"
    ],
    "Nonthaburi": [
      "Nonthaburi", "Bang Bua Thong", "Bang Kruai", "Bang Yai",
      "Mueang Nonthaburi", "Pak Kret", "Sai Noi"
    ],
    "Pathum Thani": [
      "Pathum Thani", "Khlong Luang", "Lam Luk Ka", "Lat Lum Kaeo",
      "Mueang Pathum Thani", "Nong Suea", "Sam Khok", "Thanyaburi"
    ],
    "Pattani": [
      "Pattani", "Kapho", "Khok Pho", "Mae Lan", "Mai Kaen",
      "Mueang Pattani", "Nong Chik", "Panare", "Sai Buri",
      "Thung Yang Daeng", "Yarang", "Yaring"
    ],
    "Phangnga": [
      "Phangnga", "Ko Yao", "Kapong", "Khura Buri", "Mueang Phangnga",
      "Phangnga Bay", "Takua Pa", "Takua Thung", "Thai Mueang"
    ],
    "Phatthalung": [
      "Phatthalung", "Bang Kaeo", "Khao Chaison", "Khuan Khanun",
      "Kong Ra", "Mueang Phatthalung", "Pak Phayun", "Pa Bon",
      "Si Banphot", "Tamot"
    ],
    "Phayao": [
      "Phayao", "Chiang Kham", "Chiang Muan", "Chun", "Dok Khamtai",
      "Mae Chai", "Mueang Phayao", "Phu Kamyao", "Phu Sang", "Pong"
    ],
    "Phetchabun": [
      "Phetchabun", "Bueng Sam Phan", "Chon Daen", "Khao Kho",
      "Lom Kao", "Lom Sak", "Mueang Phetchabun", "Nam Nao",
      "Nong Phai", "Si Thep", "Wichian Buri", "Wang Pong"
    ],
    "Phetchaburi": [
      "Phetchaburi", "Ban Laem", "Ban Lat", "Cha-am", "Kaeng Krachan",
      "Khao Yoi", "Mueang Phetchaburi", "Nong Ya Plong", "T'sap Yai",
      "Tha Yang"
    ],
    "Phichit": [
      "Phichit", "Bang Mun Nak", "Bueng Narang", "Dong Charoen",
      "Mueang Phichit", "Pho Prathap Chang", "Pho Thale",
      "Sam Ngam", "Sak Lek", "Taphan Hin", "Wang Sai Phun"
    ],
    "Phitsanulok": [
      "Phitsanulok", "Bang Krathum", "Chat Trakan", "Mueang Phitsanulok",
      "Nakhon Thai", "Noen Maprang", "Phrom Phiram", "Wang Thong",
      "Wat Bot"
    ],
    "Phra Nakhon Si Ayutthaya": [
      "Phra Nakhon Si Ayutthaya", "Bang Ban", "Bang Pa-in", "Bang Pahan",
      "Bang Sai", "Lat Bua Luang", "Maha Rat", "Nakhon Luang",
      "Phachi", "Phak Hai", "Phra Nakhon Si Ayutthaya", "Sena",
      "Tha Ruea", "Uthai", "Wang Noi"
    ],
    "Phrae": [
      "Phrae", "Den Chai", "Long", "Mueang Phrae", "Nong Muang Khai",
      "Rong Kwang", "Song", "Sung Men", "Wang Chin"
    ],
    "Phuket": [
      "Phuket City", "Kathu", "Mueang Phuket", "Thalang",
      "Patong", "Karon", "Kata", "Rawai", "Kamala", "Bang Tao",
      "Nai Harn", "Surin", "Chalong"
    ],
    "Prachin Buri": [
      "Prachin Buri", "Ban Sang", "Kabin Buri", "Mueang Prachin Buri",
      "Na Di", "Prachantakham", "Si Maha Phot", "Si Mahosot"
    ],
    "Prachuap Khiri Khan": [
      "Prachuap Khiri Khan", "Bang Saphan", "Bang Saphan Noi",
      "Hua Hin", "Kui Buri", "Mueang Prachuap Khiri Khan",
      "Sam Roi Yot", "Thap Sakae"
    ],
    "Ranong": [
      "Ranong", "Kra Buri", "La-un", "Mueang Ranong", "Ngao", "Suk Samran"
    ],
    "Ratchaburi": [
      "Ratchaburi", "Ban Kha", "Bang Phae", "Chom Bueng", "Damnoen Saduak",
      "Mueang Ratchaburi", "Pak Tho", "Photharam", "Suan Phueng",
      "Wat Phleng"
    ],
    "Rayong": [
      "Rayong", "Ban Chang", "Ban Kai", "Klaeng", "Mueang Rayong",
      "Nikhom Phatthana", "Pluak Daeng", "Wang Chan"
    ],
    "Roi Et": [
      "Roi Et", "At Samat", "Chaturaphak Phiman", "Kaset Wisai",
      "Moeiwadi", "Moung Roi Et", "Mueang Roi Et", "Nong Hi",
      "Nong Phok", "Pathum Rat", "Phon Sai", "Phon Thong",
      "Selaphum", "Si Somdet", "Suwan Phum", "Thawat Buri",
      "Thung Khao Luang"
    ],
    "Sa Kaeo": [
      "Sa Kaeo", "Aranyaprathet", "Khao Chakan", "Khlong Hat",
      "Khlong Yai", "Mueang Sa Kaeo", "Ta Phraya", "Wang Nam Yen",
      "Wang Sombun", "Watthana Nakhon"
    ],
    "Sakon Nakhon": [
      "Sakon Nakhon", "Akat Amnuai", "Ban Muang", "Charoen Sin",
      "Kham Ta Kla", "Krasang", "Kusuman", "Kut Bak", "Mueang Sakon Nakhon",
      "Nikhom Nam Un", "Phang Khon", "Phanna Nikhom", "Phon Na Kaeo",
      "Phu Phan", "Sawang Daen Din", "Song Dao", "Tao Ngoi",
      "Wanon Niwat", "Waritchaphum"
    ],
    "Samut Prakan": [
      "Samut Prakan", "Bang Bo", "Bang Phli", "Bang Sao Thong",
      "Mueang Samut Prakan", "Phra Pradaeng", "Phra Samut Chedi"
    ],
    "Samut Sakhon": [
      "Samut Sakhon", "Ban Phaeo", "Krathum Baen", "Mueang Samut Sakhon"
    ],
    "Samut Songkhram": [
      "Samut Songkhram", "Amphawa", "Bang Khonthi", "Mueang Samut Songkhram"
    ],
    "Saraburi": [
      "Saraburi", "Ban Mo", "Chaloem Phra Kiat", "Don Phut",
      "Kaeng Khoi", "Mueang Saraburi", "Muak Lek", "Nong Don",
      "Nong Khae", "Nong Suea", "Phra Phutthabat", "Sao Hai",
      "Wang Muang", "Wihan Daeng"
    ],
    "Satun": [
      "Satun", "Khuan Don", "Khuan Kalong", "La-ngu", "Manang",
      "Mueang Satun", "Tha Phae", "Thung Wa"
    ],
    "Sing Buri": [
      "Sing Buri", "Bang Rachan", "In Buri", "Khai Bang Rachan",
      "Mueang Sing Buri", "Phrom Buri", "Tha Chang"
    ],
    "Sisaket": [
      "Sisaket", "Benchalak", "Bueng Bun", "Huai Thap Than",
      "Kantharalak", "Kanthararom", "Khun Han", "Mueang Sisaket",
      "Nam Kliang", "Non Khun", "Pho Si Suwan", "Phu Sing",
      "Phrai Bueng", "Prasart", "Rasi Salai", "Sila Lat",
      "Uthumphon Phisai", "Wang Hin"
    ],
    "Songkhla": [
      "Songkhla", "Chana", "Hat Yai", "Klong Hoi Khong", "Khuan Niang",
      "Mueang Songkhla", "Na Mom", "Na Thawi", "Ranot", "Rattaphum",
      "Sadao", "Sating Phra", "Singhanakhon", "Saba Yoi", "Thepha"
    ],
    "Sukhothai": [
      "Sukhothai", "Ban Dan Lan Hoi", "Khiri Mat", "Kong Krailat",
      "Mueang Sukhothai", "Sawankhalok", "Si Nakhon", "Si Samrong",
      "Si Satchanalai", "Thung Saliam"
    ],
    "Suphan Buri": [
      "Suphan Buri", "Bang Pla Ma", "Dan Chang", "Doem Bang Nang Buat",
      "Mueang Suphan Buri", "Nong Ya Sai", "Sam Chuk",
      "Si Prachan", "Song Phi Nong", "U Thong"
    ],
    "Surat Thani": [
      "Surat Thani", "Ban Na Doem", "Ban Na San", "Ban Takhun",
      "Chai Buri", "Chaiya", "Don Sak", "Kanchanadit", "Khian Sa",
      "Khiri Rat Nikhom", "Ko Phangan", "Ko Samui", "Mueang Surat Thani",
      "Phanom", "Phrasaeng", "Phunphin", "Vibhavadi", "Wiang Sa"
    ],
    "Surin": [
      "Surin", "Buachet", "Chumphon Buri", "Khwao Sinarin",
      "Lam Plai Mat", "Mueang Surin", "Non Narai", "Phanom Dong Rak",
      "Prasat", "Rattanaburi", "Sangkha", "Sanom", "Si Khoraphum",
      "Si Narong", "Tha Tum"
    ],
    "Tak": [
      "Tak", "Ban Tak", "Mae Ramat", "Mae Sot", "Mae Sot border",
      "Mueang Tak", "Phob Phra", "Sam Ngao", "Tha Song Yang",
      "Umphang", "Wang Chao"
    ],
    "Trang": [
      "Trang", "Hat Samran", "Huai Yot", "Kantang", "Mueang Trang",
      "Na Yong", "Palian", "Ratsada", "Sikao", "Wang Wiset",
      "Y'an Ta Khao"
    ],
    "Trat": [
      "Trat", "Bo Rai", "Khao Saming", "Khlong Yai", "Ko Chang",
      "Ko Kut", "Ko Mak", "Laem Ngop", "Mueang Trat"
    ],
    "Ubon Ratchathani": [
      "Ubon Ratchathani", "Buntharik", "Det Udom", "Don Mot Daeng",
      "Khemmarat", "Khong Chiam", "Khueang Nai", "Khun Han",
      "Lao Suea Kok", "Mueang Ubon Ratchathani", "Muang Sam Sip",
      "Na Chaluai", "Na Tan", "Na Yia", "Nam Khun", "Namyuen",
      "Pho Sai", "Phop Phra", "Phibun Mangsahan", "Sawang Wirawong",
      "Si Mueang Mai", "Sirindhorn", "Tan Sum", "Trakan Phuet Phon",
      "Warin Chamrap"
    ],
    "Udon Thani": [
      "Udon Thani", "Ban Dung", "Ban Phue", "Chai Wan",
      "Chiang Khan", "Kumphawapi", "Kut Chap", "Mueang Udon Thani",
      "Na Yung", "Nam Som", "Nong Han", "Nong Saeng", "Nong Wua So",
      "Phen", "Phibun Rak", "Prachak Sinlapakhom", "Si That",
      "Thung Fon", "Wang Sam Mo"
    ],
    "Uthai Thani": [
      "Uthai Thani", "Ban Rai", "Huai Khot", "Khok Khwai",
      "Lan Sak", "Mueang Uthai Thani", "Nong Chang", "Nong Khayang",
      "Sawang Arom", "Thap Than"
    ],
    "Uttaradit": [
      "Uttaradit", "Ban Khok", "Fak Tha", "Laplae", "Mueang Uttaradit",
      "Nam Pat", "Phichai", "Tha Pla", "Tron"
    ],
    "Yasothon": [
      "Yasothon", "Kham Khuean Kaeo", "Kho Wang", "Loeng Nok Tha",
      "Maha Chana Chai", "Mueang Yasothon", "Pa Tio", "Sai Mun",
      "Thai Charoen"
    ],
    "Yala": [
      "Yala", "Bannang Sata", "Betong", "Kabang", "Krong Pinang",
      "Mueang Yala", "Raman", "Than To", "Yaha"
    ],
  },

  "South Korea": {
    "Seoul": [
      "Gangnam-gu", "Seocho-gu", "Mapo-gu", "Jongno-gu", "Jung-gu",
      "Songpa-gu", "Nowon-gu", "Dobong-gu", "Seodaemun-gu", "Yongsan-gu",
      "Gwangjin-gu", "Seongbuk-gu", "Dongdaemun-gu", "Jungnang-gu",
      "Gwanak-gu", "Dongjak-gu", "Yangcheon-gu", "Gangseo-gu", "Guro-gu",
      "Geumcheon-gu", "Yeongdeungpo-gu", "Eunpyeong-gu", "Seongdong-gu",
      "Gwangjin-gu", "Gangbuk-gu", "Dobong-gu"
    ],
    "Busan": [
      "Haeundae-gu", "Jung-gu", "Seo-gu", "Dong-gu", "Yeongdo-gu",
      "Busanjin-gu", "Dongnae-gu", "Nam-gu", "Buk-gu", "Saha-gu",
      "Sasang-gu", "Geumjeong-gu", "Gangseo-gu", "Yeonje-gu", "Suyeong-gu",
      "Gijang-gun", "Songjeong", "Centum City"
    ],
    "Daegu": [
      "Jung-gu", "Dong-gu", "Seo-gu", "Nam-gu", "Buk-gu",
      "Suseong-gu", "Dalseo-gu", "Dalseong-gun"
    ],
    "Incheon": [
      "Jung-gu", "Dong-gu", "Michuhol-gu", "Yeonsu-gu", "Namdong-gu",
      "Bupyeong-gu", "Gyeyang-gu", "Seo-gu", "Ganghwa-gun", "Ongjin-gun",
      "Songdo International Business District"
    ],
    "Gwangju": [
      "Dong-gu", "Seo-gu", "Nam-gu", "Buk-gu", "Gwangsan-gu"
    ],
    "Daejeon": [
      "Dong-gu", "Jung-gu", "Seo-gu", "Yuseong-gu", "Daedeok-gu"
    ],
    "Ulsan": [
      "Jung-gu", "Nam-gu", "Dong-gu", "Buk-gu", "Ulju-gun"
    ],
    "Sejong": [
      "Sejong City", "Jochiwon", "Yeongi", "Gongju-si (border area)"
    ],
    "Gyeonggi-do": [
      "Suwon", "Seongnam", "Bucheon", "Goyang", "Yongin", "Ansan",
      "Anyang", "Hwaseong", "Pyeongtaek", "Uijeongbu", "Siheung",
      "Gwangju", "Hanam", "Osan", "Gunpo", "Uiwang", "Gimpo",
      "Paju", "Yangju", "Pocheon", "Yeoncheon", "Dongducheon",
      "Gapyeong", "Gwacheon", "Icheon", "Anseong", "Yangpyeong"
    ],
    "Gangwon-do": [
      "Chuncheon", "Wonju", "Gangneung", "Donghae", "Sokcho",
      "Samcheok", "Taebaek", "Yangyang", "Goseong", "Yeongwol",
      "Pyeongchang", "Jeongseon", "Hongcheon", "Hoengseong",
      "Cheorwon", "Hwacheon", "Yanggu", "Inje", "Aryang"
    ],
    "Chungcheongbuk-do": [
      "Cheongju", "Chungju", "Jecheon", "Boeun", "Okcheon",
      "Yeongdong", "Jeungpyeong", "Jincheon", "Goesan", "Eumseong", "Danyang"
    ],
    "Chungcheongnam-do": [
      "Cheonan", "Gongju", "Asan", "Seosan", "Nonsan", "Gyeryong",
      "Dangjin", "Buyeo", "Boryeong", "Hongseong", "Yesan",
      "Taean", "Cheongyang", "Geumsan", "Seocheon"
    ],
    "Jeollabuk-do": [
      "Jeonju", "Iksan", "Gunsan", "Jeongeup", "Namwon", "Gimje",
      "Wanju", "Jinan", "Muju", "Jangsu", "Sunchang", "Gochang",
      "Buan", "Imsil"
    ],
    "Jeollanam-do": [
      "Mokpo", "Yeosu", "Suncheon", "Naju", "Gwangyang", "Damyang",
      "Gokseong", "Gurye", "Goheung", "Boseong", "Hwasun", "Jangheung",
      "Gangjin", "Haenam", "Yeongam", "Muan", "Hampyeong", "Yeonggwang",
      "Jangseong", "Wando", "Jindo", "Sinan"
    ],
    "Gyeongsangbuk-do": [
      "Pohang", "Gyeongju", "Gumi", "Andong", "Gimcheon", "Yeongju",
      "Yeongcheon", "Gyeongsan", "Mungyeong", "Sangju", "Uiseong",
      "Cheongsong", "Yeongyang", "Bonghwa", "Uljin", "Seongju",
      "Chilgok", "Yecheon", "Gunwi", "Cheongdo", "Goryeong"
    ],
    "Gyeongsangnam-do": [
      "Changwon", "Jinju", "Gimhae", "Tongyeong", "Sacheon", "Geoje",
      "Yangsan", "Haman", "Miryang", "Namhae", "Hadong", "Sancheong",
      "Hamyang", "Geochang", "Changnyeong", "Uiryeong", "Goseong"
    ],
    "Jeju-do": [
      "Jeju City", "Seogwipo", "Aewol", "Hallim", "Hanrim", "Seongsan",
      "Pyoseon", "Namwon", "Daejeong", "Andeok", "Jocheon", "Gujwa"
    ],
  },
};
```

- [ ] **Step 2: Verify the file parses without TypeScript errors**

```bash
npx tsc --noEmit features/users/data/country-locations.ts 2>&1 | head -20
```

Expected: no output (no errors).

---

### Task 2: Update UserForm.tsx — imports, constants, and shared derived logic

**Files:**
- Modify: `features/users/components/UserForm.tsx`

- [ ] **Step 1: Add the import at the top of UserForm.tsx**

Find the existing import block near the top of the file. After the import for `myanmarNrcTownships`, add:

```ts
import { COUNTRY_LOCATIONS } from "@/features/users/data/country-locations";
```

- [ ] **Step 2: Replace the COUNTRIES constant**

Find this block (around line 50):

```ts
const COUNTRIES = [
  "Afghanistan","Australia","Brazil","Cambodia","China","Colombia",
  "India","Indonesia","Japan","Madagascar","Malawi","Malaysia",
  "Mozambique","Myanmar","Pakistan","Philippines","Russia",
  "Singapore","South Korea","Sri Lanka","Tanzania","Thailand",
  "UK","USA","Vietnam","Zambia","Zimbabwe",
].sort();
```

Replace it with:

```ts
const COUNTRIES = ["Myanmar", "Thailand", "South Korea"];
```

---

### Task 3: Update UserEditForm — cascading dropdowns

**Files:**
- Modify: `features/users/components/UserForm.tsx` (UserEditForm section)

- [ ] **Step 1: Remove legacy country fallback from UserEditForm country select**

Find the country `<select>` in UserEditForm (around line 636). It currently has a legacy fallback option — remove it:

```tsx
<select
  className="ud-select"
  value={country}
  onChange={e => { setCountry(e.target.value); setStateVal(""); setCity(""); mark(); }}
>
  <option value="">Select country</option>
  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
</select>
```

(Delete the `{user.country && !COUNTRIES.includes(user.country) && ...}` block — not needed since data can be freely updated.)

- [ ] **Step 2: Add derived state for available states and cities**

In `UserEditForm`, after the `isMyanmar` derived value (around line 206), add:

```ts
const availableStates = country ? Object.keys(COUNTRY_LOCATIONS[country] ?? {}) : [];
const availableCities = country && stateVal
  ? (COUNTRY_LOCATIONS[country]?.[stateVal] ?? [])
  : [];
```

- [ ] **Step 3: Replace the State / Region input with a select**

Find the State / Region field in UserEditForm (inside the `ud-address-grid`):

```tsx
<div className="ud-field">
  <label className="ud-label">State / Region</label>
  <input
    className="ud-input"
    placeholder="State or region"
    value={stateVal}
    maxLength={100}
    onChange={e => { setStateVal(e.target.value); mark(); }}
  />
</div>
```

Replace with:

```tsx
<div className="ud-field">
  <label className="ud-label">State / Region</label>
  <select
    className="ud-select"
    value={stateVal}
    disabled={!country || availableStates.length === 0}
    onChange={e => { setStateVal(e.target.value); setCity(""); mark(); }}
  >
    <option value="">Select state / region</option>
    {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
</div>
```

- [ ] **Step 4: Replace the City input with a select**

Find the City field in UserEditForm (inside the `ud-address-grid`):

```tsx
<div className="ud-field">
  <label className="ud-label">City</label>
  <input
    className="ud-input"
    placeholder="City"
    value={city}
    maxLength={100}
    onChange={e => { setCity(e.target.value); mark(); }}
  />
</div>
```

Replace with:

```tsx
<div className="ud-field">
  <label className="ud-label">City</label>
  <select
    className="ud-select"
    value={city}
    disabled={!stateVal || availableCities.length === 0}
    onChange={e => { setCity(e.target.value); mark(); }}
  >
    <option value="">Select city</option>
    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
  </select>
</div>
```

---

### Task 4: Update UserCreateForm — default country + cascading dropdowns

**Files:**
- Modify: `features/users/components/UserForm.tsx` (UserCreateForm section)

- [ ] **Step 1: Set Myanmar as the default country in UserCreateForm**

Find in `UserCreateForm` (around line 1165):

```ts
const [country,  setCountry]  = useState("");
```

Replace with:

```ts
const [country,  setCountry]  = useState("Myanmar");
```

- [ ] **Step 2: Add derived state for available states and cities**

In `UserCreateForm`, after `const isMyanmar = country === "Myanmar";`, add:

```ts
const availableStates = country ? Object.keys(COUNTRY_LOCATIONS[country] ?? {}) : [];
const availableCities = country && stateVal
  ? (COUNTRY_LOCATIONS[country]?.[stateVal] ?? [])
  : [];
```

- [ ] **Step 3: Replace the State / Region input with a select in UserCreateForm**

Find the State / Region field in UserCreateForm (inside the `ud-address-grid`, around line 1512):

```tsx
<div className="ud-field">
  <label className="ud-label">State / Region</label>
  <input
    className="ud-input"
    placeholder="State or region"
    value={stateVal}
    maxLength={100}
    onChange={e => setStateVal(e.target.value)}
  />
</div>
```

Replace with:

```tsx
<div className="ud-field">
  <label className="ud-label">State / Region</label>
  <select
    className="ud-select"
    value={stateVal}
    disabled={!country || availableStates.length === 0}
    onChange={e => { setStateVal(e.target.value); setCity(""); }}
  >
    <option value="">Select state / region</option>
    {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
</div>
```

- [ ] **Step 4: Replace the City input with a select in UserCreateForm**

Find the City field in UserCreateForm (inside the `ud-address-grid`, around line 1520):

```tsx
<div className="ud-field">
  <label className="ud-label">City</label>
  <input
    className="ud-input"
    placeholder="City"
    value={city}
    maxLength={100}
    onChange={e => setCity(e.target.value)}
  />
</div>
```

Replace with:

```tsx
<div className="ud-field">
  <label className="ud-label">City</label>
  <select
    className="ud-select"
    value={city}
    disabled={!stateVal || availableCities.length === 0}
    onChange={e => setCity(e.target.value)}
  >
    <option value="">Select city</option>
    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
  </select>
</div>
```

- [ ] **Step 5: Remove the no-longer-needed fallback option in UserCreateForm Country select**

In UserCreateForm, the country `<select>` currently maps over all `COUNTRIES`. Since the list is now 3 items with no legacy fallback needed, verify the select renders cleanly:

```tsx
<select
  className="ud-select"
  value={country}
  onChange={e => { setCountry(e.target.value); setStateVal(""); setCity(""); }}
>
  <option value="">Select country</option>
  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
</select>
```

This is already the correct shape — no change needed here, just confirm it matches.

---

### Task 5: Verify in the browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the edit form**

Open `http://localhost:3000/admin/users/<any-user-id>/edit`.

Checklist:
- Country dropdown shows exactly: Myanmar, Thailand, South Korea
- If the user's saved country is Thailand → Thailand is pre-selected (not Myanmar)
- Selecting Myanmar → State/Region dropdown populates with 15 Myanmar states/regions
- Selecting "Yangon Region" → City dropdown populates with Yangon, Thanlyin, etc.
- Changing country resets state and city to blank
- Changing state resets city to blank
- State dropdown is disabled when no country selected
- City dropdown is disabled when no state selected

- [ ] **Step 3: Test the create form**

Open `http://localhost:3000/admin/users/new`.

Checklist:
- Country defaults to Myanmar on load
- State/Region dropdown is pre-populated with Myanmar's 15 states/regions
- Selecting Thailand → state dropdown switches to Thailand's provinces
- Selecting a province → city dropdown populates
- Creating a user with all three fields set → saves correctly (check the edit form after save)

- [ ] **Step 4: Stop the dev server**
