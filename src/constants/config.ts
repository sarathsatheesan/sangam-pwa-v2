export const ADMIN_EMAILS = ['sarath.s1884@gmail.com'];

// Encryption salt for E2E message encryption key derivation
export const ENCRYPTION_SALT = 'sangam_e2e_v1_salt';

export const AVATAR_OPTIONS = [
  '🧑',
  '👩',
  '👨',
  '👧',
  '🧒',
  '👵',
  '🧓',
  '👴',
  '🧔',
  '👱',
  '👲',
  '🧕',
  '👳',
  '💁',
  '🙋',
  '🤷',
  '🦸',
  '🧑‍💻',
  '👩‍💻',
  '👨‍💻',
  '👩‍🎓',
  '👨‍🎓',
  '👩‍🏫',
  '👨‍⚕️',
];

// 3-tier ethnicity hierarchy: Region → Sub-region → Specific Ethnicities
// Ordered by most commonly used / largest diaspora populations first
export const ETHNICITY_HIERARCHY: { region: string; subregions: { name: string; ethnicities: string[] }[] }[] = [
  { region: 'Asian', subregions: [
    { name: 'South Asian', ethnicities: ['Indian', 'Pakistani', 'Bangladeshi', 'Sri Lankan', 'Nepali', 'Bhutanese', 'Maldivian', 'Afghan'] },
    { name: 'East Asian', ethnicities: ['Chinese', 'Japanese', 'Korean', 'Taiwanese', 'Mongolian', 'Tibetan', 'Hong Konger'] },
    { name: 'Southeast Asian', ethnicities: ['Filipino', 'Vietnamese', 'Indonesian', 'Thai', 'Malaysian', 'Burmese', 'Cambodian', 'Laotian', 'Singaporean', 'Hmong'] },
    { name: 'Central Asian', ethnicities: ['Kazakh', 'Uzbek', 'Tajik', 'Kyrgyz', 'Turkmen'] },
  ]},
  { region: 'Hispanic or Latino', subregions: [
    { name: 'Mexican', ethnicities: ['Mexican', 'Mexican American', 'Chicano'] },
    { name: 'Caribbean', ethnicities: ['Puerto Rican', 'Cuban', 'Dominican', 'Jamaican', 'Haitian', 'Trinidadian', 'Barbadian', 'Bahamian'] },
    { name: 'South American', ethnicities: ['Brazilian', 'Colombian', 'Argentine', 'Peruvian', 'Venezuelan', 'Chilean', 'Ecuadorian', 'Bolivian', 'Paraguayan', 'Uruguayan', 'Guyanese', 'Surinamese'] },
    { name: 'Central American', ethnicities: ['Salvadoran', 'Guatemalan', 'Honduran', 'Nicaraguan', 'Costa Rican', 'Panamanian', 'Belizean'] },
    { name: 'Spanish', ethnicities: ['Spanish (from Spain)'] },
  ]},
  { region: 'European', subregions: [
    { name: 'Western European', ethnicities: ['English', 'German', 'French', 'Irish', 'Dutch', 'Belgian', 'Swiss', 'Austrian', 'Scottish', 'Welsh', 'Luxembourgish'] },
    { name: 'Southern European', ethnicities: ['Italian', 'Spanish', 'Greek', 'Portuguese', 'Croatian', 'Serbian', 'Albanian', 'Maltese', 'Bosnian', 'Montenegrin', 'Slovenian', 'Macedonian', 'Cypriot'] },
    { name: 'Eastern European', ethnicities: ['Russian', 'Polish', 'Ukrainian', 'Romanian', 'Czech', 'Hungarian', 'Bulgarian', 'Slovak', 'Belarusian', 'Moldovan', 'Georgian', 'Armenian'] },
    { name: 'Northern European', ethnicities: ['Swedish', 'Norwegian', 'Danish', 'Finnish', 'Icelandic', 'Estonian', 'Latvian', 'Lithuanian'] },
  ]},
  { region: 'African', subregions: [
    { name: 'African American / Black British', ethnicities: ['African American', 'Black British', 'Afro-Caribbean', 'Afro-Latino'] },
    { name: 'West African', ethnicities: ['Nigerian', 'Ghanaian', 'Senegalese', 'Ivorian', 'Malian', 'Sierra Leonean', 'Liberian', 'Guinean', 'Togolese', 'Beninese', 'Burkinabe', 'Gambian', 'Cape Verdean'] },
    { name: 'East African', ethnicities: ['Ethiopian', 'Kenyan', 'Somali', 'Tanzanian', 'Ugandan', 'Rwandan', 'Eritrean', 'Burundian', 'South Sudanese', 'Djiboutian'] },
    { name: 'North African', ethnicities: ['Egyptian', 'Moroccan', 'Algerian', 'Tunisian', 'Libyan', 'Sudanese'] },
    { name: 'Southern African', ethnicities: ['South African', 'Zimbabwean', 'Motswana', 'Namibian', 'Mozambican', 'Zambian', 'Malawian', 'Swazi', 'Basotho', 'Malagasy'] },
    { name: 'Central African', ethnicities: ['Congolese', 'Cameroonian', 'Angolan', 'Chadian', 'Gabonese', 'Central African', 'Equatorial Guinean'] },
  ]},
  { region: 'Middle Eastern', subregions: [
    { name: 'Levantine', ethnicities: ['Lebanese', 'Syrian', 'Palestinian', 'Jordanian', 'Iraqi'] },
    { name: 'Arabian Peninsula', ethnicities: ['Saudi', 'Emirati', 'Kuwaiti', 'Qatari', 'Bahraini', 'Omani', 'Yemeni'] },
    { name: 'Persian / Iranian', ethnicities: ['Persian', 'Iranian', 'Kurdish'] },
    { name: 'Turkish', ethnicities: ['Turkish'] },
    { name: 'Israeli / Jewish', ethnicities: ['Israeli', 'Ashkenazi Jewish', 'Sephardic Jewish', 'Mizrahi Jewish'] },
  ]},
  { region: 'Oceanian / Pacific Islander', subregions: [
    { name: 'Polynesian', ethnicities: ['Native Hawaiian', 'Samoan', 'Tongan', 'Maori', 'Tahitian', 'Cook Islander'] },
    { name: 'Melanesian', ethnicities: ['Fijian', 'Papua New Guinean', 'Solomon Islander', 'Ni-Vanuatu', 'New Caledonian'] },
    { name: 'Micronesian', ethnicities: ['Chamorro', 'Guamanian', 'Marshallese', 'Palauan', 'Chuukese', 'Kosraean'] },
    { name: 'Australian', ethnicities: ['Australian'] },
    { name: 'New Zealander', ethnicities: ['New Zealander', 'Pakeha'] },
  ]},
  { region: 'Indigenous & Native People', subregions: [
    { name: 'Native American / Alaska Native', ethnicities: ['Native American', 'Alaska Native', 'Cherokee', 'Navajo', 'Sioux', 'Ojibwe', 'Apache'] },
    { name: 'First Nations / Inuit / Métis', ethnicities: ['First Nations', 'Inuit', 'Métis'] },
    { name: 'Aboriginal / Torres Strait Islander', ethnicities: ['Aboriginal Australian', 'Torres Strait Islander'] },
    { name: 'Maori', ethnicities: ['Maori'] },
    { name: 'Sámi', ethnicities: ['Sámi'] },
    { name: 'Ainu', ethnicities: ['Ainu'] },
  ]},
  { region: 'Multiracial & Other', subregions: [
    { name: 'Multiracial', ethnicities: ['Two or More Races', 'Multiracial', 'Biracial'] },
    { name: 'Not Listed', ethnicities: ['Other / EthniZity not listed'] },
  ]},
  { region: 'Prefer Not to Say', subregions: [
    { name: 'Privacy', ethnicities: ['Prefer not to say', 'Decline to self-identify'] },
  ]},
];

// Sub-items under specific ethnicities (e.g., Indian states)
export const ETHNICITY_CHILDREN: Record<string, string[]> = {
  'Indian': [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  ],
};

// Priority ethnicities shown at top of dropdown for quick access
// Can be region names, subregion names, or ethnicity names from the hierarchy
export const PRIORITY_ETHNICITIES: string[] = [
  'Indian',
  'Hispanic or Latino',
  'Chinese',
  'French',
  'Oceanian / Pacific Islander',
];

// Flat lists derived from hierarchy (backward-compatible exports)
export const HERITAGE_OPTIONS = [
  ...ETHNICITY_HIERARCHY.flatMap(r => r.subregions.flatMap(s => s.ethnicities)),
  ...Object.values(ETHNICITY_CHILDREN).flat(),
];

// Mapping of common terms to ethnicity suggestions for auto-suggest
export const ETHNICITY_KEYWORDS: Record<string, string[]> = {
  african: ['African American', 'Ethiopian', 'Nigerian', 'Ghanaian'],
  black: ['African American', 'Black British', 'Afro-Caribbean'],
  indian: ['Indian'], pakistani: ['Pakistani'], bangladeshi: ['Bangladeshi'],
  chinese: ['Chinese'], japanese: ['Japanese'], korean: ['Korean'],
  vietnamese: ['Vietnamese'], filipino: ['Filipino'], thai: ['Thai'],
  indonesian: ['Indonesian'], malaysian: ['Malaysian'], hmong: ['Hmong'],
  mexican: ['Mexican', 'Mexican American'], cuban: ['Cuban'], colombian: ['Colombian'],
  brazilian: ['Brazilian'], argentine: ['Argentine'], peruvian: ['Peruvian'],
  italian: ['Italian'], german: ['German'], french: ['French'],
  irish: ['Irish'], english: ['English'], scottish: ['Scottish'],
  russian: ['Russian'], polish: ['Polish'], ukrainian: ['Ukrainian'],
  armenian: ['Armenian'], georgian: ['Georgian'],
  lebanese: ['Lebanese'], syrian: ['Syrian'], iranian: ['Iranian', 'Persian'],
  turkish: ['Turkish'], kurdish: ['Kurdish'], israeli: ['Israeli'],
  jewish: ['Ashkenazi Jewish', 'Sephardic Jewish', 'Mizrahi Jewish'],
  hawaiian: ['Native Hawaiian'], samoan: ['Samoan'], fijian: ['Fijian'],
  aboriginal: ['Aboriginal Australian'], maori: ['Maori'],
  native: ['Native American', 'Alaska Native', 'Native Hawaiian'],
  nepali: ['Nepali'], afghan: ['Afghan'],
  sri_lankan: ['Sri Lankan'], bhutanese: ['Bhutanese'], maldivian: ['Maldivian'],
  eritrean: ['Eritrean'], somali: ['Somali'], ethiopian: ['Ethiopian'],
  nigerian: ['Nigerian'], ghanaian: ['Ghanaian'],
};

// Comprehensive country-ethnicity mapping by region (36 unique Indian ethnicities + international data)
export const COUNTRY_ETHNICITY_MAP: { region: string; countries: { name: string; ethnicities: string[] }[] }[] = [
  {
    region: 'South Asia',
    countries: [
      {
        name: 'India',
        ethnicities: [
          'Telugu / Andhra',
          'Arunachali',
          'Assamese',
          'Bihari',
          'Chhattisgarhi',
          'Goan',
          'Gujarati',
          'Haryanvi',
          'Himachali / Pahari',
          'Jharkhandi',
          'Kannadiga',
          'Malayali',
          'Madhya Pradeshi',
          'Marathi / Maharashtrian',
          'Meitei / Manipuri',
          'Khasi',
          'Garo',
          'Mizo',
          'Naga',
          'Odia',
          'Punjabi',
          'Rajasthani',
          'Sikkimese',
          'Tamil',
          'Telugu / Telangana',
          'Tripuri',
          'Hindi-speaking',
          'Uttarakhandi',
          'Bengali',
          'Nicobarese',
          'Kashmiri',
          'Dogra',
          'Ladakhi',
          'Lakshadweep Muslim',
          'Sindhi',
          'Nepali / Indian',
        ],
      },
      {
        name: 'Pakistan',
        ethnicities: ['Punjabi', 'Pashtun', 'Sindhi', 'Muhajir / Urdu-speaking', 'Saraiki', 'Baloch'],
      },
      {
        name: 'Bangladesh',
        ethnicities: ['Bengali'],
      },
      {
        name: 'Sri Lanka',
        ethnicities: ['Sinhalese', 'Tamil', 'Moor / Sri Lankan Muslim'],
      },
      {
        name: 'Nepal',
        ethnicities: ['Chhetri', 'Brahmin-Hill', 'Magar', 'Tharu', 'Tamang', 'Newar', 'Kami'],
      },
      {
        name: 'Bhutan',
        ethnicities: ['Drukpa / Ngalop', 'Lhotshampka / Nepali-speaking', 'Sharchop'],
      },
      {
        name: 'Maldives',
        ethnicities: ['Dhivehi / Maldivian'],
      },
      {
        name: 'Afghanistan',
        ethnicities: ['Pashtun', 'Tajik', 'Hazara', 'Uzbek', 'Aimak'],
      },
    ],
  },
  {
    region: 'East Asia',
    countries: [
      {
        name: 'China',
        ethnicities: ['Han Chinese', 'Zhuang'],
      },
      {
        name: 'Japan',
        ethnicities: ['Yamato / Japanese'],
      },
      {
        name: 'South Korea',
        ethnicities: ['Korean'],
      },
      {
        name: 'North Korea',
        ethnicities: ['Korean'],
      },
      {
        name: 'Taiwan',
        ethnicities: ['Hoklo / Min-speaking', 'Hakka', 'Mainlander Han'],
      },
      {
        name: 'Mongolia',
        ethnicities: ['Khalkha Mongol', 'Kazakh'],
      },
      {
        name: 'Hong Kong',
        ethnicities: ['Chinese'],
      },
      {
        name: 'Macau',
        ethnicities: ['Chinese', 'Macanese/Portuguese'],
      },
      {
        name: 'Tibet',
        ethnicities: ['Tibetan', 'Han Chinese'],
      },
    ],
  },
  {
    region: 'Southeast Asia',
    countries: [
      {
        name: 'Philippines',
        ethnicities: ['Tagalog', 'Cebuano', 'Iloko', 'Bisaya', 'Hiligaynon', 'Bikol', 'Waray'],
      },
      {
        name: 'Vietnam',
        ethnicities: ['Kinh / Vietnamese', 'Tay'],
      },
      {
        name: 'Indonesia',
        ethnicities: ['Javanese', 'Sundanese', 'Malay', 'Madurese'],
      },
      {
        name: 'Thailand',
        ethnicities: ['Thai / Central Thai', 'Isan / Lao-Thai', 'Northern Thai / Lanna', 'Southern Thai', 'Chinese-Thai'],
      },
      {
        name: 'Malaysia',
        ethnicities: ['Malay / Bumiputra', 'Chinese', 'Indian', 'Indigenous Sabah/Sarawak'],
      },
      {
        name: 'Myanmar',
        ethnicities: ['Bamar / Burman', 'Shan', 'Karen', 'Rakhine'],
      },
      {
        name: 'Cambodia',
        ethnicities: ['Khmer'],
      },
      {
        name: 'Laos',
        ethnicities: ['Lao / Lowland Lao', 'Khmou', 'Hmong', 'Phouthay'],
      },
      {
        name: 'Singapore',
        ethnicities: ['Chinese', 'Malay', 'Indian'],
      },
      {
        name: 'Brunei',
        ethnicities: ['Malay', 'Chinese', 'Indigenous'],
      },
      {
        name: 'Timor-Leste',
        ethnicities: ['Tetum', 'Mambai', 'Makasae', 'Fataluku', 'Kemak', 'Bunak', 'Tokodede'],
      },
    ],
  },
  {
    region: 'Central Asia',
    countries: [
      {
        name: 'Kazakhstan',
        ethnicities: ['Kazakh', 'Russian', 'Uzbek'],
      },
      {
        name: 'Uzbekistan',
        ethnicities: ['Uzbek', 'Tajik', 'Russian'],
      },
      {
        name: 'Tajikistan',
        ethnicities: ['Tajik', 'Uzbek'],
      },
      {
        name: 'Kyrgyzstan',
        ethnicities: ['Kyrgyz', 'Uzbek', 'Russian'],
      },
      {
        name: 'Turkmenistan',
        ethnicities: ['Turkmen', 'Uzbek', 'Russian'],
      },
    ],
  },
  {
    region: 'Middle East',
    countries: [
      {
        name: 'Lebanon',
        ethnicities: ['Arab', 'Armenian'],
      },
      {
        name: 'Syria',
        ethnicities: ['Arab', 'Kurdish'],
      },
      {
        name: 'Iraq',
        ethnicities: ['Arab', 'Kurdish', 'Turkmen'],
      },
      {
        name: 'Iran',
        ethnicities: ['Persian', 'Azerbaijani', 'Kurdish', 'Lur', 'Baloch', 'Arab'],
      },
      {
        name: 'Turkey',
        ethnicities: ['Turkish', 'Kurdish'],
      },
      {
        name: 'Palestine',
        ethnicities: ['Palestinian Arab'],
      },
      {
        name: 'Israel',
        ethnicities: ['Jewish', 'Arab', 'Druze'],
      },
      {
        name: 'Saudi Arabia',
        ethnicities: ['Arab Saudi', 'South Asian migrants', 'Other Arab', 'Southeast Asian migrants'],
      },
      {
        name: 'UAE',
        ethnicities: ['Emirati Arab', 'Indian', 'Pakistani', 'Bangladeshi', 'Filipino', 'Other Arab'],
      },
      {
        name: 'Kuwait',
        ethnicities: ['Kuwaiti Arab', 'Other Arab', 'South Asian'],
      },
      {
        name: 'Qatar',
        ethnicities: ['Qatari Arab', 'Indian', 'Nepali', 'Other Arab', 'Filipino', 'Bangladeshi'],
      },
      {
        name: 'Bahrain',
        ethnicities: ['Bahraini Arab', 'South Asian', 'Other Arab'],
      },
      {
        name: 'Oman',
        ethnicities: ['Omani Arab', 'South Asian', 'Other Arab'],
      },
      {
        name: 'Yemen',
        ethnicities: ['Yemeni Arab'],
      },
      {
        name: 'Jordan',
        ethnicities: ['Arab Jordanian', 'Palestinian', 'Syrian'],
      },
    ],
  },
  {
    region: 'North Africa',
    countries: [
      {
        name: 'Egypt',
        ethnicities: ['Egyptian Arab', 'Nubian'],
      },
      {
        name: 'Morocco',
        ethnicities: ['Arab', 'Berber / Amazigh'],
      },
      {
        name: 'Algeria',
        ethnicities: ['Arab', 'Berber / Amazigh'],
      },
      {
        name: 'Tunisia',
        ethnicities: ['Arab', 'Berber / Amazigh'],
      },
      {
        name: 'Libya',
        ethnicities: ['Arab', 'Berber / Amazigh'],
      },
      {
        name: 'Sudan',
        ethnicities: ['Sudanese Arab', 'Fur', 'Beja', 'Nuba', 'Nubian'],
      },
    ],
  },
  {
    region: 'West Africa',
    countries: [
      {
        name: 'Nigeria',
        ethnicities: ['Hausa', 'Yoruba', 'Igbo', 'Fulani', 'Ijaw', 'Kanuri', 'Tiv'],
      },
      {
        name: 'Ghana',
        ethnicities: ['Akan / Ashanti', 'Mole-Dagbani', 'Ewe', 'Ga-Adangme', 'Guan'],
      },
      {
        name: 'Senegal',
        ethnicities: ['Wolof', 'Fulani / Peul', 'Serer', 'Jola', 'Mandinka'],
      },
      {
        name: 'Ivory Coast',
        ethnicities: ['Akan', 'Kru', 'Northern Mandé', 'Gur / Senoufo', 'Southern Mandé'],
      },
      {
        name: 'Mali',
        ethnicities: ['Bambara', 'Fulani', 'Soninke', 'Senufo', 'Dogon', 'Malinké', 'Tuareg'],
      },
      {
        name: 'Sierra Leone',
        ethnicities: ['Temne', 'Mende', 'Limba', 'Kono'],
      },
      {
        name: 'Liberia',
        ethnicities: ['Kpelle', 'Bassa', 'Grebo', 'Gio', 'Mano', 'Kru', 'Lorma'],
      },
      {
        name: 'Guinea',
        ethnicities: ['Fulani', 'Mandinka', 'Susu', 'Kissi'],
      },
      {
        name: 'Togo',
        ethnicities: ['Ewe', 'Kabye', 'Tem', 'Mina'],
      },
      {
        name: 'Benin',
        ethnicities: ['Fon', 'Yoruba', 'Bariba', 'Fulani', 'Somba', 'Adja'],
      },
      {
        name: 'Burkina Faso',
        ethnicities: ['Mossi', 'Fulani', 'Gourounsi', 'Bobo', 'Mande'],
      },
      {
        name: 'Gambia',
        ethnicities: ['Mandinka', 'Fula', 'Wolof', 'Jola', 'Serahuli'],
      },
      {
        name: 'Cape Verde',
        ethnicities: ['Creole / Mixed', 'African'],
      },
      {
        name: 'Niger',
        ethnicities: ['Hausa', 'Zarma-Songhai', 'Fulani', 'Tuareg', 'Kanuri'],
      },
      {
        name: 'Mauritania',
        ethnicities: ['Arab-Berber / Moor', 'Fulani', 'Soninke', 'Wolof'],
      },
      {
        name: 'Guinea-Bissau',
        ethnicities: ['Balanta', 'Fula', 'Mandinka', 'Papel', 'Manjago', 'Beafada'],
      },
    ],
  },
  {
    region: 'East Africa',
    countries: [
      {
        name: 'Ethiopia',
        ethnicities: ['Oromo', 'Amhara', 'Somali', 'Tigray', 'Sidama'],
      },
      {
        name: 'Kenya',
        ethnicities: ['Kikuyu', 'Luhya', 'Kalenjin', 'Luo', 'Kamba', 'Somali', 'Kisii', 'Meru'],
      },
      {
        name: 'Somalia',
        ethnicities: ['Somali', 'Bantu'],
      },
      {
        name: 'Tanzania',
        ethnicities: ['Sukuma', 'Nyamwezi', 'Chaga', 'Haya'],
      },
      {
        name: 'Uganda',
        ethnicities: ['Baganda', 'Banyankore', 'Basoga', 'Bakiga', 'Iteso', 'Langi', 'Acholi'],
      },
      {
        name: 'Rwanda',
        ethnicities: ['Hutu', 'Tutsi'],
      },
      {
        name: 'Eritrea',
        ethnicities: ['Tigrinya', 'Tigre', 'Saho', 'Afar'],
      },
      {
        name: 'Burundi',
        ethnicities: ['Hutu', 'Tutsi'],
      },
      {
        name: 'South Sudan',
        ethnicities: ['Dinka', 'Nuer', 'Shilluk', 'Bari'],
      },
      {
        name: 'Djibouti',
        ethnicities: ['Somali / Issa', 'Afar'],
      },
      {
        name: 'Madagascar',
        ethnicities: ['Merina', 'Betsimisaraka', 'Betsileo', 'Sakalava', 'Tsimihety', 'Antaisaka'],
      },
    ],
  },
  {
    region: 'Southern Africa',
    countries: [
      {
        name: 'South Africa',
        ethnicities: ['Zulu', 'Xhosa', 'Sotho', 'Tswana', 'Coloured / Mixed', 'White / European', 'Tsonga', 'Swazi', 'Indian/Asian'],
      },
      {
        name: 'Zimbabwe',
        ethnicities: ['Shona', 'Ndebele', 'White'],
      },
      {
        name: 'Botswana',
        ethnicities: ['Tswana', 'Kalanga'],
      },
      {
        name: 'Namibia',
        ethnicities: ['Ovambo', 'Kavango', 'Herero', 'Damara', 'White Namibian', 'Nama', 'Coloured'],
      },
      {
        name: 'Mozambique',
        ethnicities: ['Makhuwa', 'Tsonga', 'Lomwe', 'Sena', 'Shona', 'Chuwabu'],
      },
      {
        name: 'Zambia',
        ethnicities: ['Bemba', 'Tonga', 'Chewa', 'Lozi', 'Nsenga', 'Lunda', 'Kaonde'],
      },
      {
        name: 'Malawi',
        ethnicities: ['Chewa', 'Tumbuka', 'Lomwe', 'Yao', 'Ngoni', 'Sena'],
      },
      {
        name: 'Eswatini (Swaziland)',
        ethnicities: ['Swazi', 'Zulu'],
      },
      {
        name: 'Lesotho',
        ethnicities: ['Sotho / Basotho'],
      },
      {
        name: 'Angola',
        ethnicities: ['Ovimbundu', 'Mbundu / Kimbundu', 'Kikongo', 'Lunda-Chokwe', 'Nyaneka-Humbe'],
      },
    ],
  },
  {
    region: 'Central Africa',
    countries: [
      {
        name: 'DR Congo',
        ethnicities: ['Luba', 'Mongo', 'Kongo', 'Azande', 'Banyarwanda'],
      },
      {
        name: 'Cameroon',
        ethnicities: ['Bamileke', 'Fang', 'Fulani', 'Duala', 'Ewondo', 'Kirdi'],
      },
      {
        name: 'Republic of Congo',
        ethnicities: ['Kongo', 'Teke', 'Mboshi', 'Sangha'],
      },
      {
        name: 'Chad',
        ethnicities: ['Sara', 'Arab', 'Kanem-Bornu', 'Wadai / Maba', 'Gorane / Toubou', 'Tandjile'],
      },
      {
        name: 'Gabon',
        ethnicities: ['Fang', 'Mpongwe', 'Mbere', 'Punu'],
      },
      {
        name: 'Central African Republic',
        ethnicities: ['Gbaya', 'Banda', 'Mandjia', 'Sara', 'Mbaka'],
      },
      {
        name: 'Equatorial Guinea',
        ethnicities: ['Fang', 'Bubi'],
      },
    ],
  },
  {
    region: 'Hispanic or Latino',
    countries: [
      {
        name: 'Hispanic or Latino',
        ethnicities: ['Mexican', 'Mexican American', 'Chicano', 'Puerto Rican', 'Cuban', 'Dominican', 'Salvadoran', 'Colombian', 'Guatemalan', 'Honduran', 'Ecuadorian', 'Peruvian', 'Venezuelan', 'Nicaraguan', 'Argentine', 'Chilean', 'Brazilian', 'Costa Rican', 'Panamanian', 'Bolivian', 'Uruguayan', 'Paraguayan', 'Spanish (from Spain)', 'Other Hispanic or Latino'],
      },
    ],
  },
  {
    region: 'Mexico & Central America',
    countries: [
      {
        name: 'Mexico',
        ethnicities: ['Mestizo', 'Amerindian', 'European-descended'],
      },
      {
        name: 'Guatemala',
        ethnicities: ['Ladino / Mestizo', 'K\'iche\'', 'Q\'eqchi\'', 'Kaqchikel', 'Mam'],
      },
      {
        name: 'Honduras',
        ethnicities: ['Mestizo', 'Amerindian'],
      },
      {
        name: 'El Salvador',
        ethnicities: ['Mestizo', 'European-descended'],
      },
      {
        name: 'Nicaragua',
        ethnicities: ['Mestizo', 'European-descended', 'Afro-Caribbean'],
      },
      {
        name: 'Costa Rica',
        ethnicities: ['Mestizo', 'European-descended', 'Mulatto', 'Amerindian'],
      },
      {
        name: 'Panama',
        ethnicities: ['Mestizo', 'Afro-Panamanian', 'European-descended', 'Amerindian'],
      },
      {
        name: 'Belize',
        ethnicities: ['Mestizo', 'Creole', 'Maya', 'Garifuna'],
      },
    ],
  },
  {
    region: 'Caribbean',
    countries: [
      {
        name: 'Cuba',
        ethnicities: ['Mestizo / Mulatto', 'European-descended', 'Afro-Cuban'],
      },
      {
        name: 'Dominican Republic',
        ethnicities: ['Mestizo / Mixed', 'European-descended', 'Afro-Dominican'],
      },
      {
        name: 'Puerto Rico',
        ethnicities: ['Mixed / Mestizo', 'European-descended', 'Afro-Puerto Rican'],
      },
      {
        name: 'Jamaica',
        ethnicities: ['Afro-Jamaican', 'Mixed', 'East Indian'],
      },
      {
        name: 'Haiti',
        ethnicities: ['Afro-Haitian', 'Mulatto'],
      },
      {
        name: 'Trinidad and Tobago',
        ethnicities: ['East Indian', 'African-descended', 'Mixed', 'European'],
      },
      {
        name: 'Bahamas',
        ethnicities: ['Afro-Bahamian', 'European-descended'],
      },
      {
        name: 'Barbados',
        ethnicities: ['Afro-Barbadian'],
      },
      {
        name: 'Guyana',
        ethnicities: ['Indo-Guyanese', 'Afro-Guyanese', 'Mixed', 'Amerindian'],
      },
      {
        name: 'Suriname',
        ethnicities: ['Hindustani / East Indian', 'Creole', 'Maroon', 'Javanese', 'Mixed', 'Amerindian'],
      },
    ],
  },
  {
    region: 'South America',
    countries: [
      {
        name: 'Brazil',
        ethnicities: ['Pardo / Mixed', 'European-descended', 'Afro-Brazilian'],
      },
      {
        name: 'Colombia',
        ethnicities: ['Mestizo', 'European-descended', 'Afro-Colombian', 'Mulatto'],
      },
      {
        name: 'Argentina',
        ethnicities: ['European-descended', 'Mestizo'],
      },
      {
        name: 'Peru',
        ethnicities: ['Mestizo', 'Quechua', 'European-descended', 'Aymara'],
      },
      {
        name: 'Venezuela',
        ethnicities: ['Mestizo / Pardo', 'European-descended'],
      },
      {
        name: 'Chile',
        ethnicities: ['European-descended / Mestizo', 'Mapuche'],
      },
      {
        name: 'Ecuador',
        ethnicities: ['Mestizo', 'Amerindian', 'European-descended', 'Afro-Ecuadorian', 'Montubio'],
      },
      {
        name: 'Bolivia',
        ethnicities: ['Mestizo', 'Quechua', 'Aymara'],
      },
      {
        name: 'Paraguay',
        ethnicities: ['Mestizo'],
      },
      {
        name: 'Uruguay',
        ethnicities: ['European-descended', 'Mestizo'],
      },
    ],
  },
  {
    region: 'Western Europe',
    countries: [
      {
        name: 'England',
        ethnicities: ['White British', 'South Asian', 'Black / African-Caribbean'],
      },
      {
        name: 'Scotland',
        ethnicities: ['White Scottish', 'Other White British'],
      },
      {
        name: 'Wales',
        ethnicities: ['White Welsh / British'],
      },
      {
        name: 'Ireland',
        ethnicities: ['Irish', 'Other White', 'Polish'],
      },
      {
        name: 'France',
        ethnicities: ['French', 'North African Arab', 'Sub-Saharan African'],
      },
      {
        name: 'Germany',
        ethnicities: ['German', 'Turkish'],
      },
      {
        name: 'Netherlands',
        ethnicities: ['Dutch', 'Turkish', 'Moroccan', 'Indonesian-Surinamese'],
      },
      {
        name: 'Belgium',
        ethnicities: ['Flemish', 'Walloon', 'Other'],
      },
      {
        name: 'Switzerland',
        ethnicities: ['German-Swiss', 'French-Swiss', 'Italian-Swiss'],
      },
      {
        name: 'Austria',
        ethnicities: ['Austrian German', 'Turkish'],
      },
      {
        name: 'Luxembourg',
        ethnicities: ['Luxembourger', 'Portuguese', 'French', 'Belgian'],
      },
    ],
  },
  {
    region: 'Southern Europe',
    countries: [
      {
        name: 'Italy',
        ethnicities: ['Italian'],
      },
      {
        name: 'Spain',
        ethnicities: ['Castilian / Spanish', 'Catalan', 'Galician', 'Basque'],
      },
      {
        name: 'Portugal',
        ethnicities: ['Portuguese'],
      },
      {
        name: 'Greece',
        ethnicities: ['Greek', 'Albanian'],
      },
      {
        name: 'Croatia',
        ethnicities: ['Croat'],
      },
      {
        name: 'Serbia',
        ethnicities: ['Serb', 'Hungarian'],
      },
      {
        name: 'Albania',
        ethnicities: ['Albanian', 'Greek'],
      },
      {
        name: 'Malta',
        ethnicities: ['Maltese'],
      },
      {
        name: 'Bosnia & Herzegovina',
        ethnicities: ['Bosniak', 'Serb', 'Croat'],
      },
      {
        name: 'Montenegro',
        ethnicities: ['Montenegrin', 'Serb', 'Bosniak', 'Albanian'],
      },
      {
        name: 'Slovenia',
        ethnicities: ['Slovene', 'Serb', 'Croat'],
      },
      {
        name: 'North Macedonia',
        ethnicities: ['Macedonian', 'Albanian', 'Turkish'],
      },
      {
        name: 'Cyprus',
        ethnicities: ['Greek Cypriot', 'Turkish Cypriot'],
      },
    ],
  },
  {
    region: 'Eastern Europe',
    countries: [
      {
        name: 'Russia',
        ethnicities: ['Russian', 'Tatar'],
      },
      {
        name: 'Poland',
        ethnicities: ['Polish'],
      },
      {
        name: 'Ukraine',
        ethnicities: ['Ukrainian', 'Russian'],
      },
      {
        name: 'Romania',
        ethnicities: ['Romanian', 'Hungarian'],
      },
      {
        name: 'Czech Republic',
        ethnicities: ['Czech'],
      },
      {
        name: 'Hungary',
        ethnicities: ['Hungarian / Magyar', 'Roma'],
      },
      {
        name: 'Bulgaria',
        ethnicities: ['Bulgarian', 'Turkish'],
      },
      {
        name: 'Slovakia',
        ethnicities: ['Slovak', 'Hungarian', 'Roma'],
      },
      {
        name: 'Belarus',
        ethnicities: ['Belarusian', 'Russian'],
      },
      {
        name: 'Moldova',
        ethnicities: ['Moldovan / Romanian', 'Ukrainian', 'Russian', 'Gagauz'],
      },
      {
        name: 'Georgia',
        ethnicities: ['Georgian', 'Azerbaijani', 'Armenian'],
      },
      {
        name: 'Armenia',
        ethnicities: ['Armenian'],
      },
    ],
  },
  {
    region: 'Northern Europe',
    countries: [
      {
        name: 'Sweden',
        ethnicities: ['Swedish', 'Finnish-origin'],
      },
      {
        name: 'Norway',
        ethnicities: ['Norwegian'],
      },
      {
        name: 'Denmark',
        ethnicities: ['Danish', 'Turkish'],
      },
      {
        name: 'Finland',
        ethnicities: ['Finnish', 'Swedish-speaking Finn'],
      },
      {
        name: 'Iceland',
        ethnicities: ['Icelandic', 'Polish'],
      },
      {
        name: 'Estonia',
        ethnicities: ['Estonian', 'Russian'],
      },
      {
        name: 'Latvia',
        ethnicities: ['Latvian', 'Russian'],
      },
      {
        name: 'Lithuania',
        ethnicities: ['Lithuanian', 'Polish', 'Russian'],
      },
    ],
  },
  {
    region: 'Oceania & Pacific',
    countries: [
      {
        name: 'Australia',
        ethnicities: ['Anglo-Australian', 'Other European', 'Asian', 'Aboriginal / Torres Strait Islander'],
      },
      {
        name: 'New Zealand',
        ethnicities: ['European / Pakeha', 'Maori', 'Asian'],
      },
      {
        name: 'Fiji',
        ethnicities: ['iTaukei / Indigenous Fijian', 'Indo-Fijian'],
      },
      {
        name: 'Papua New Guinea',
        ethnicities: ['Enga', 'Chimbu', 'Hagen / Western Highlands', 'Sepik peoples'],
      },
      {
        name: 'Samoa',
        ethnicities: ['Samoan'],
      },
      {
        name: 'Tonga',
        ethnicities: ['Tongan'],
      },
      {
        name: 'Solomon Islands',
        ethnicities: ['Melanesian'],
      },
      {
        name: 'Vanuatu',
        ethnicities: ['Ni-Vanuatu / Melanesian'],
      },
      {
        name: 'Palau',
        ethnicities: ['Palauan', 'Filipino', 'Chinese'],
      },
      {
        name: 'Marshall Islands',
        ethnicities: ['Marshallese'],
      },
      {
        name: 'Guam',
        ethnicities: ['Chamorro', 'Filipino', 'White American', 'Chuukese', 'Other Pacific Islander'],
      },
      {
        name: 'Micronesia',
        ethnicities: ['Chuukese', 'Pohnpeian', 'Kosraean', 'Yapese'],
      },
    ],
  },
  {
    region: 'Indigenous & Native Peoples',
    countries: [
      {
        name: 'Native American (United States)',
        ethnicities: ['Navajo', 'Cherokee', 'Sioux / Lakota', 'Chippewa / Ojibwe'],
      },
      {
        name: 'First Nations / Inuit / Métis (Canada)',
        ethnicities: ['First Nations', 'Métis', 'Inuit', 'Cree', 'Ojibwe', 'Dene', 'Blackfoot', 'Mi\'kmaq', 'Mohawk'],
      },
      {
        name: 'Aboriginal Australian',
        ethnicities: ['Aboriginal', 'Torres Strait Islander'],
      },
      {
        name: 'Maori (New Zealand)',
        ethnicities: ['Maori', 'Ngapuhi', 'Ngati Porou', 'Waikato-Tainui', 'Ngai Tahu', 'Tuhoe'],
      },
      {
        name: 'Sámi (Scandinavia)',
        ethnicities: ['Northern Sámi', 'Lule Sámi', 'Southern Sámi'],
      },
      {
        name: 'Ainu (Japan)',
        ethnicities: ['Ainu'],
      },
    ],
  },
];

// Flat helper: all country names and ethnicities from COUNTRY_ETHNICITY_MAP
export const ALL_COUNTRY_ETHNICITIES: string[] = COUNTRY_ETHNICITY_MAP.flatMap(r => r.countries.flatMap(c => [c.name, ...c.ethnicities]));

export const POST_TYPES = ['community', 'question', 'recommendation', 'event', 'news'];

export const BUSINESS_CATEGORIES = [
  'Restaurant',
  'Grocery',
  'Technology',
  'Healthcare',
  'Education',
  'Real Estate',
  'Legal',
  'Financial',
  'Beauty & Spa',
  'Automotive',
  'Home Services',
  'Religious/Spiritual',
  'Entertainment',
  'Fitness',
  'Photo/Videography',
  'Retail',
  'Other',
];

// Extended business types for signup registration
export const BUSINESS_TYPES = [
  'Agriculture & Farming',
  'Arts & Entertainment',
  'Automotive',
  'Beauty & Wellness',
  'Boutique',
  'Clothing / Fashion',
  'Construction',
  'Education & Tutoring',
  'Financial Services',
  'Fitness & Gym',
  'Grocery & Market',
  'Healthcare / Medical',
  'Henna',
  'Home Services',
  'Hotels',
  'Jewelry',
  'Legal & Immigration',
  'Media & Advertising',
  'Non-Profit',
  'Photo/Videography',
  'Real Estate / Property',
  'Religious / Spiritual',
  'Restaurant & Food',
  'Retail / E-Commerce',
  'Technology / IT Services',
  'Tiffin',
  'Transportation & Logistics',
  'Travel & Tourism',
  'Other',
];

export const EVENT_TYPES = [
  'Cultural',
  'Community',
  'Religious',
  'Sports',
  'Educational',
  'Networking',
  'Family',
  'Music',
  'Food',
  'Other',
];

export const LISTING_TYPES = ['rent', 'sale', 'roommate', 'sublet'];

export interface ForumTopic {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const FORUM_TOPICS: ForumTopic[] = [
  { id: 'immigration', name: 'Immigration & Visa', icon: '📋', description: 'H1B, green card, citizenship, visa queries' },
  { id: 'career', name: 'Career & Jobs', icon: '💼', description: 'Job search, interviews, career advice, networking' },
  { id: 'finance', name: 'Finance & Taxes', icon: '💰', description: 'Investing, tax filing, remittances, FBAR/FATCA' },
  { id: 'parenting', name: 'Parenting & Family', icon: '👨‍👩‍👧‍👦', description: 'Raising kids bicultural, schools, family dynamics' },
  { id: 'food', name: 'Food & Recipes', icon: '🍛', description: 'Regional recipes, grocery finds, restaurant reviews' },
  { id: 'health', name: 'Health & Wellness', icon: '🏥', description: 'Finding doctors, Ayurveda, mental health, insurance' },
  { id: 'education', name: 'Education', icon: '🎓', description: 'College admissions, test prep, tutoring, STEM programs' },
  { id: 'relationships', name: 'Relationships & Marriage', icon: '💑', description: 'Dating, wedding planning, cultural expectations' },
  { id: 'religion', name: 'Religion & Spirituality', icon: '🙏', description: 'Temples, mosques, gurdwaras, festivals, spiritual practice' },
  { id: 'sports', name: 'Sports & Cricket', icon: '🏏', description: 'IPL, cricket leagues, badminton, local sports' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', description: 'Bollywood, regional cinema, music, streaming' },
  { id: 'technology', name: 'Technology & Startups', icon: '💻', description: 'Tech careers, startups, AI/ML, coding' },
  { id: 'legal', name: 'Legal Advice', icon: '⚖️', description: 'Immigration law, tenant rights, general legal questions' },
  { id: 'civic', name: 'Civic & Politics', icon: '🗳️', description: 'Voter info, community organizing, policy advocacy' },
  { id: 'general', name: 'General Discussion', icon: '💬', description: 'Anything else, off-topic, community announcements' },
];

export const REPORT_REASONS = [
  { id: 'hate_speech', label: 'Hate Speech', description: 'Content targeting race, ethnicity, religion, or caste' },
  { id: 'harassment', label: 'Harassment', description: 'Bullying, threats, or personal attacks' },
  { id: 'spam', label: 'Spam', description: 'Unwanted promotional or repetitive content' },
  { id: 'explicit', label: 'Explicit Content', description: 'Sexual or graphic violence content' },
  { id: 'misinformation', label: 'Misinformation', description: 'False or misleading information' },
  { id: 'scam', label: 'Scam / Fraud', description: 'Phishing, financial fraud, or scam attempts' },
  { id: 'other', label: 'Other', description: 'Something else that violates community guidelines' },
];

export const US_STATES_CITIES: Record<string, string[]> = {
  Utah: [
    'Salt Lake City',
    'Sandy',
    'Draper',
    'Murray',
    'Provo',
    'Orem',
    'Lehi',
    'Layton',
    'West Jordan',
    'West Valley City',
    'American Fork',
    'South Jordan',
    'Riverton',
    'Taylorsville',
    'Logan',
    'Ogden',
    'Farmington',
    'Roy',
    'Kaysville',
    'Bountiful',
    'Centerville',
    'Sugarhouse',
    'Park City',
    'Moab',
    'Spanish Fork',
    'Salem',
    'Mapleton',
    'Saratoga Springs',
    'Cedar Hills',
    'Herriman',
    'Eagle Mountain',
    'Payson',
    'Ephraim',
    'Manti',
    'Gunnison',
    'Salina',
    'Richfield',
  ],
  California: [
    'Los Angeles',
    'San Francisco',
    'San Diego',
    'Sacramento',
    'Long Beach',
    'Oakland',
    'Fresno',
    'Bakersfield',
    'Anaheim',
    'Santa Ana',
    'Riverside',
    'Stockton',
    'Irvine',
    'Santa Clarita',
    'Chula Vista',
    'San Bernardino',
    'Fontana',
    'Moreno Valley',
    'Glendale',
    'Huntington Park',
  ],
  Texas: [
    'Houston',
    'Dallas',
    'Austin',
    'San Antonio',
    'Fort Worth',
    'Arlington',
    'Corpus Christi',
    'Plano',
    'Garland',
    'Irving',
    'Laredo',
    'Lubbock',
    'Amarillo',
    'Brownsville',
    'Tyler',
  ],
  'New York': [
    'New York City',
    'Buffalo',
    'Rochester',
    'Yonkers',
    'Syracuse',
    'Albany',
    'Schenectady',
    'New Rochelle',
    'Troy',
    'Niagara Falls',
  ],
  'New Jersey': [
    'Newark',
    'Jersey City',
    'Paterson',
    'Elizabeth',
    'Trenton',
    'Atlantic City',
    'Camden',
    'Clifton',
    'Irvington',
    'Passaic',
  ],
  Illinois: [
    'Chicago',
    'Aurora',
    'Rockford',
    'Joliet',
    'Naperville',
    'Springfield',
    'Peoria',
    'Elgin',
    'Waukegan',
    'Cicero',
  ],
  Washington: [
    'Seattle',
    'Spokane',
    'Tacoma',
    'Vancouver',
    'Bellevue',
    'Kent',
    'Everett',
    'Renton',
    'Kirkland',
    'Sammamish',
  ],
  Georgia: [
    'Atlanta',
    'Augusta',
    'Columbus',
    'Savannah',
    'Macon',
    'Sandy Springs',
    'Johns Creek',
    'Marietta',
    'Alpharetta',
    'Roswell',
  ],
  Virginia: [
    'Virginia Beach',
    'Richmond',
    'Arlington',
    'Alexandria',
    'Blacksburg',
    'Charlottesville',
    'Roanoke',
    'Leesburg',
    'Fairfax',
    'Falls Church',
  ],
  Maryland: [
    'Baltimore',
    'Frederick',
    'Gaithersburg',
    'Bowie',
    'Annapolis',
    'College Park',
    'Towson',
    'Silver Spring',
    'Bethesda',
    'Takoma Park',
  ],
  Pennsylvania: [
    'Philadelphia',
    'Pittsburgh',
    'Allentown',
    'Erie',
    'Reading',
    'Scranton',
    'Bethlehem',
    'Lancaster',
    'Harrisburg',
    'Altoona',
  ],
  Massachusetts: [
    'Boston',
    'Worcester',
    'Springfield',
    'Cambridge',
    'Providence',
    'Somerville',
    'Lowell',
    'Brockton',
    'Quincy',
    'Lynn',
  ],
  Florida: [
    'Jacksonville',
    'Miami',
    'Tampa',
    'Orlando',
    'St. Petersburg',
    'Hialeah',
    'Tallahassee',
    'Fort Lauderdale',
    'Port St. Lucie',
    'Ft. Myers',
  ],
  Ohio: [
    'Columbus',
    'Cleveland',
    'Cincinnati',
    'Toledo',
    'Akron',
    'Dayton',
    'Youngstown',
    'Canton',
    'Gahanna',
    'Parma',
  ],
  Michigan: [
    'Detroit',
    'Grand Rapids',
    'Warren',
    'Sterling Heights',
    'Ann Arbor',
    'Lansing',
    'Flint',
    'Dearborn',
    'Livonia',
    'Westland',
  ],
  'North Carolina': [
    'Charlotte',
    'Raleigh',
    'Greensboro',
    'Durham',
    'Chapel Hill',
    'Wilmington',
    'High Point',
    'Fayetteville',
    'Cary',
    'Winston-Salem',
  ],
  Arizona: [
    'Phoenix',
    'Mesa',
    'Scottsdale',
    'Chandler',
    'Glendale',
    'Tempe',
    'Peoria',
    'Gilbert',
    'Tucson',
    'Casas Adobes',
  ],
  Colorado: [
    'Denver',
    'Colorado Springs',
    'Aurora',
    'Fort Collins',
    'Lakewood',
    'Pueblo',
    'Arvada',
    'Littleton',
    'Westminster',
    'Boulder',
  ],
  Oregon: [
    'Portland',
    'Eugene',
    'Salem',
    'Gresham',
    'Hillsboro',
    'Bend',
    'Beaverton',
    'Medford',
    'Springfield',
    'Corvallis',
  ],
  Minnesota: [
    'Minneapolis',
    'Saint Paul',
    'Rochester',
    'Duluth',
    'Saint Cloud',
    'Bloomington',
    'Edina',
    'Minnetonka',
    'Plymouth',
    'Maple Grove',
  ],
  Connecticut: [
    'Bridgeport',
    'New Haven',
    'Hartford',
    'Stamford',
    'Waterbury',
    'Norwalk',
    'Danbury',
    'New Britain',
    'West Hartford',
    'Meriden',
  ],
  Tennessee: [
    'Nashville',
    'Memphis',
    'Knoxville',
    'Chattanooga',
    'Clarksville',
    'Murfreesboro',
    'Franklin',
    'Jackson',
    'Johnson City',
    'Kingsport',
  ],
  'Canada': ['Toronto', 'Vancouver', 'Brampton', 'Mississauga', 'Surrey', 'Calgary', 'Edmonton', 'Ottawa', 'Montreal'],
  'United Kingdom': ['London', 'Birmingham', 'Leicester', 'Manchester', 'Leeds', 'Bradford', 'Glasgow', 'Edinburgh'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'],
  'UAE': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'],
  'Singapore': ['Singapore'],
  'Germany': ['Berlin', 'Munich', 'Frankfurt', 'Hamburg'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch'],
};

export const ZIP_TO_CITY_STATE: Record<string, { city: string; state: string }> = {
  '84101': { city: 'Salt Lake City', state: 'Utah' },
  '84102': { city: 'Salt Lake City', state: 'Utah' },
  '84103': { city: 'Salt Lake City', state: 'Utah' },
  '84104': { city: 'Salt Lake City', state: 'Utah' },
  '84105': { city: 'Salt Lake City', state: 'Utah' },
  '84106': { city: 'Salt Lake City', state: 'Utah' },
  '84107': { city: 'Salt Lake City', state: 'Utah' },
  '84108': { city: 'Salt Lake City', state: 'Utah' },
  '84109': { city: 'Salt Lake City', state: 'Utah' },
  '84110': { city: 'Salt Lake City', state: 'Utah' },
  '84111': { city: 'Salt Lake City', state: 'Utah' },
  '84112': { city: 'Salt Lake City', state: 'Utah' },
  '84113': { city: 'Salt Lake City', state: 'Utah' },
  '84114': { city: 'Salt Lake City', state: 'Utah' },
  '84115': { city: 'Salt Lake City', state: 'Utah' },
  '84116': { city: 'Salt Lake City', state: 'Utah' },
  '84117': { city: 'Salt Lake City', state: 'Utah' },
  '84118': { city: 'Salt Lake City', state: 'Utah' },
  '84119': { city: 'Salt Lake City', state: 'Utah' },
  '84120': { city: 'Salt Lake City', state: 'Utah' },
  '84121': { city: 'Sandy', state: 'Utah' },
  '84122': { city: 'Sandy', state: 'Utah' },
  '84123': { city: 'Sandy', state: 'Utah' },
  '84124': { city: 'Draper', state: 'Utah' },
  '84125': { city: 'Murray', state: 'Utah' },
  '84126': { city: 'West Jordan', state: 'Utah' },
  '84127': { city: 'West Jordan', state: 'Utah' },
  '84128': { city: 'Riverton', state: 'Utah' },
  '84129': { city: 'Herriman', state: 'Utah' },
  '84130': { city: 'Taylorsville', state: 'Utah' },
  '84131': { city: 'Taylorsville', state: 'Utah' },
  '84132': { city: 'South Jordan', state: 'Utah' },
  '84133': { city: 'South Jordan', state: 'Utah' },
  '84134': { city: 'West Valley City', state: 'Utah' },
  '84135': { city: 'West Valley City', state: 'Utah' },
  '84136': { city: 'West Valley City', state: 'Utah' },
  '84137': { city: 'West Valley City', state: 'Utah' },
  '84138': { city: 'American Fork', state: 'Utah' },
  '84139': { city: 'Lehi', state: 'Utah' },
  '84141': { city: 'Orem', state: 'Utah' },
  '84142': { city: 'Orem', state: 'Utah' },
  '84143': { city: 'Orem', state: 'Utah' },
  '84144': { city: 'Provo', state: 'Utah' },
  '84145': { city: 'Provo', state: 'Utah' },
  '84146': { city: 'Provo', state: 'Utah' },
  '84147': { city: 'Provo', state: 'Utah' },
  '84148': { city: 'Provo', state: 'Utah' },
  '84150': { city: 'Provo', state: 'Utah' },
  '84157': { city: 'Provo', state: 'Utah' },
  '84158': { city: 'Provo', state: 'Utah' },
  '84160': { city: 'Salt Lake City', state: 'Utah' },
  '84161': { city: 'Salt Lake City', state: 'Utah' },
  '84170': { city: 'Salt Lake City', state: 'Utah' },
  '84180': { city: 'Salt Lake City', state: 'Utah' },
  '84190': { city: 'Salt Lake City', state: 'Utah' },
  '84199': { city: 'Salt Lake City', state: 'Utah' },
  '84201': { city: 'Ogden', state: 'Utah' },
  '84202': { city: 'Ogden', state: 'Utah' },
  '84203': { city: 'Ogden', state: 'Utah' },
  '84204': { city: 'Ogden', state: 'Utah' },
  '84207': { city: 'Layton', state: 'Utah' },
  '84208': { city: 'Farmington', state: 'Utah' },
  '84209': { city: 'Kaysville', state: 'Utah' },
  '84210': { city: 'Bountiful', state: 'Utah' },
  '84211': { city: 'Logan', state: 'Utah' },
  '84221': { city: 'Park City', state: 'Utah' },
  '84760': { city: 'Moab', state: 'Utah' },
  '84761': { city: 'Moab', state: 'Utah' },
};
