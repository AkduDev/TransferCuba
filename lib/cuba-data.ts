export interface Business {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  description: string;
  province: string;
  municipality: string;
  neighborhood?: string;
  address: string;
  lat: number;
  lng: number;
  acceptsTransfer: boolean;
  transferActiveNow: boolean; // ¿Acepta transferencia ahora?
  transferDetails: {
    transfermovil: boolean;
    enzona: boolean;
    qrPayment: boolean;
    onlineGateway: boolean;
    cash: boolean;
  };
  transferVerified: boolean; // Verificado por DevParadise
  lastStatusUpdate: string; // e.g. "Hace 15 min", "Hace 2 horas"
  lastUpdatedDate: string; // ISO date
  confirmationsCount: number; // 👍 Votos confirmados
  reportsCount: number; // 👎 Reportes
  userConfirmedRecently?: boolean;
  hours: string;
  whatsapp: string;
  phone: string;
  rating: number;
  reviewsCount: number;
  photos: string[];
  featured: boolean;
  status: 'active' | 'pending' | 'rejected';
  distanceMeters?: number; // Calculated dynamically if user location is set
}

export interface ProvinceData {
  name: string;
  slug: string;
  center: [number, number];
  zoom: number;
  municipalities: string[];
}

export const CUBAN_PROVINCES: ProvinceData[] = [
  {
    name: 'La Habana',
    slug: 'la-habana',
    center: [23.1136, -82.3666],
    zoom: 13,
    municipalities: [
      'Plaza de la Revolución',
      'Playa',
      'Centro Habana',
      'Habana Vieja',
      'Diez de Octubre',
      'Cerro',
      'Marianao',
      'La Lisa',
      'Boyeros',
      'Arroyo Naranjo',
      'San Miguel del Padrón',
      'Guanabacoa',
      'Regla',
      'Habana del Este',
      'Cotorro'
    ]
  },
  {
    name: 'Santiago de Cuba',
    slug: 'santiago-de-cuba',
    center: [20.0208, -75.8267],
    zoom: 13,
    municipalities: [
      'Santiago de Cuba',
      'Contramaestre',
      'Palma Soriano',
      'San Luis',
      'Songo - La Maya'
    ]
  },
  {
    name: 'Holguín',
    slug: 'holguin',
    center: [20.8872, -76.2631],
    zoom: 13,
    municipalities: [
      'Holguín',
      'Banes',
      'Gibara',
      'Moa',
      'Mayarí',
      'Rafael Freyre'
    ]
  },
  {
    name: 'Matanzas',
    slug: 'matanzas',
    center: [23.0411, -81.5775],
    zoom: 12,
    municipalities: [
      'Matanzas',
      'Cárdenas (Varadero)',
      'Jovellanos',
      'Colón',
      'Jagüey Grande'
    ]
  },
  {
    name: 'Villa Clara',
    slug: 'villa-clara',
    center: [22.4069, -79.9647],
    zoom: 13,
    municipalities: [
      'Santa Clara',
      'Placetas',
      'Camajuaní',
      'Caibarién',
      'Sagua la Grande'
    ]
  },
  {
    name: 'Camagüey',
    slug: 'camaguey',
    center: [21.3808, -77.9169],
    zoom: 13,
    municipalities: [
      'Camagüey',
      'Florida',
      'Guáimaro',
      'Nuevitas',
      'Esmeralda'
    ]
  },
  {
    name: 'Cienfuegos',
    slug: 'cienfuegos',
    center: [22.1496, -80.4438],
    zoom: 13,
    municipalities: [
      'Cienfuegos',
      'Cruces',
      'Cumanayagua',
      'Palmira',
      'Rodas'
    ]
  },
  {
    name: 'Pinar del Río',
    slug: 'pinar-del-rio',
    center: [22.4175, -83.6978],
    zoom: 13,
    municipalities: [
      'Pinar del Río',
      'Viñales',
      'Consolación del Sur',
      'Sandino'
    ]
  }
];

export const CATEGORIES = [
  { id: 'all', label: 'Todas las categorías', icon: 'Store' },
  { id: 'comida', label: 'Comida & Restaurantes', icon: 'Utensils' },
  { id: 'tiendas', label: 'Tiendas & Mercados', icon: 'ShoppingBag' },
  { id: 'farmacias', label: 'Farmacias & Salud', icon: 'Pill' },
  { id: 'cafeterias', label: 'Cafeterías & Panaderías', icon: 'Coffee' },
  { id: 'servicios', label: 'Servicios & Celulares', icon: 'Smartphone' },
  { id: 'ferreteria', label: 'Ferretería & Hogar', icon: 'Wrench' },
  { id: 'ropa', label: 'Ropa & Calzado', icon: 'Shirt' }
];

export const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'biz-1',
    name: 'La Esquina Market',
    category: 'tiendas',
    categoryIcon: 'ShoppingBag',
    description: 'Minisupermercado con amplia variedad de víveres, enlatados, confituras, lácteos y productos de higiene.',
    province: 'La Habana',
    municipality: 'Plaza de la Revolución',
    neighborhood: 'Vedado',
    address: 'Calle 23 #123 e/ L y M, Vedado',
    lat: 23.1382,
    lng: -82.3855,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: true,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 12 min',
    lastUpdatedDate: new Date(Date.now() - 12 * 60000).toISOString(),
    confirmationsCount: 48,
    reportsCount: 1,
    hours: '08:00 — 21:00 (Lunes a Domingo)',
    whatsapp: '+5352849102',
    phone: '+5378321045',
    rating: 4.8,
    reviewsCount: 64,
    photos: [
      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=600&q=80'
    ],
    featured: true,
    status: 'active'
  },
  {
    id: 'biz-2',
    name: 'Pizzería & Trattoria Bella Napoli',
    category: 'comida',
    categoryIcon: 'Utensils',
    description: 'Pizzas artesanales al horno de leña, pastas frescas y bebidas frías. Servicio en mesa y para llevar.',
    province: 'La Habana',
    municipality: 'Habana Vieja',
    neighborhood: 'Centro Histórico',
    address: 'Calle Obispo #358 e/ Habana y Compostela',
    lat: 23.1389,
    lng: -82.3551,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 35 min',
    lastUpdatedDate: new Date(Date.now() - 35 * 60000).toISOString(),
    confirmationsCount: 32,
    reportsCount: 0,
    hours: '11:30 — 23:00',
    whatsapp: '+5353119842',
    phone: '+5378624410',
    rating: 4.7,
    reviewsCount: 51,
    photos: [
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'
    ],
    featured: true,
    status: 'active'
  },
  {
    id: 'biz-3',
    name: 'Taller TechHabana Fix',
    category: 'servicios',
    categoryIcon: 'Smartphone',
    description: 'Reparación especializada de móviles iPhone, Samsung y Xiaomi. Cambio de pantallas, baterías y accesorios.',
    province: 'La Habana',
    municipality: 'Centro Habana',
    neighborhood: 'San Rafael',
    address: 'Bulevar de San Rafael #204 e/ Águila y Galiano',
    lat: 23.1374,
    lng: -82.3615,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 1 hora',
    lastUpdatedDate: new Date(Date.now() - 60 * 60000).toISOString(),
    confirmationsCount: 29,
    reportsCount: 0,
    hours: '09:00 — 18:00 (Lunes a Sábado)',
    whatsapp: '+5354920193',
    phone: '+5378679021',
    rating: 4.9,
    reviewsCount: 38,
    photos: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80'
    ],
    featured: false,
    status: 'active'
  },
  {
    id: 'biz-4',
    name: 'Farmacia & Óptica San Lázaro',
    category: 'farmacias',
    categoryIcon: 'Pill',
    description: 'Medicamentos autorizados, suplementos, insumos sanitarios de primera necesidad y artículos para bebé.',
    province: 'La Habana',
    municipality: 'Centro Habana',
    neighborhood: 'Cayo Hueso',
    address: 'Calle San Lázaro #610 esq. Belascoaín',
    lat: 23.1415,
    lng: -82.3702,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: false,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 2 horas',
    lastUpdatedDate: new Date(Date.now() - 120 * 60000).toISOString(),
    confirmationsCount: 65,
    reportsCount: 2,
    hours: '08:30 — 19:00',
    whatsapp: '+5352109844',
    phone: '+5378783011',
    rating: 4.6,
    reviewsCount: 42,
    photos: [
      'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=600&q=80'
    ],
    featured: false,
    status: 'active'
  },
  {
    id: 'biz-5',
    name: 'Cafetería & Panadería El Prado',
    category: 'cafeterias',
    categoryIcon: 'Coffee',
    description: 'Pan recién horneado, dulces finos, café expreso cubano, sándwiches tostados y jugos naturales.',
    province: 'La Habana',
    municipality: 'Habana Vieja',
    neighborhood: 'Paseo del Prado',
    address: 'Paseo de Martí (Prado) #452 e/ San Rafael y San José',
    lat: 23.1362,
    lng: -82.3592,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 15 min',
    lastUpdatedDate: new Date(Date.now() - 15 * 60000).toISOString(),
    confirmationsCount: 54,
    reportsCount: 0,
    hours: '07:30 — 22:00',
    whatsapp: '+5353891024',
    phone: '+5378619940',
    rating: 4.8,
    reviewsCount: 77,
    photos: [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80'
    ],
    featured: true,
    status: 'active'
  },
  {
    id: 'biz-6',
    name: 'Ferretería El Tornillo Feliz',
    category: 'ferreteria',
    categoryIcon: 'Wrench',
    description: 'Materiales eléctricos, tuberías plásticas, herramientas manuales, tornillería, bombillos LED y pintura.',
    province: 'La Habana',
    municipality: 'Diez de Octubre',
    neighborhood: 'Santos Suárez',
    address: 'Calzada de 10 de Octubre #842 e/ Santa Irene y San Mariano',
    lat: 23.0995,
    lng: -82.3688,
    acceptsTransfer: true,
    transferActiveNow: false, // Temporalmente sin transfer por fallo de conexión local
    transferDetails: {
      transfermovil: true,
      enzona: false,
      qrPayment: false,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 40 min',
    lastUpdatedDate: new Date(Date.now() - 40 * 60000).toISOString(),
    confirmationsCount: 18,
    reportsCount: 5,
    hours: '08:30 — 17:00 (Lunes a Sábado)',
    whatsapp: '+5352667788',
    phone: '+5376402219',
    rating: 4.3,
    reviewsCount: 22,
    photos: [
      'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=600&q=80'
    ],
    featured: false,
    status: 'active'
  },
  {
    id: 'biz-7',
    name: 'Agromercado & Frutas 19 y B',
    category: 'tiendas',
    categoryIcon: 'ShoppingBag',
    description: 'Viandas frescas, vegetales, frutas de estación, carnes limpias y condimentos del campo cubano.',
    province: 'La Habana',
    municipality: 'Plaza de la Revolución',
    neighborhood: 'Vedado',
    address: 'Calle 19 esq. a Calle B, Vedado',
    lat: 23.1432,
    lng: -82.3921,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 5 min',
    lastUpdatedDate: new Date(Date.now() - 5 * 60000).toISOString(),
    confirmationsCount: 88,
    reportsCount: 1,
    hours: '07:30 — 16:30',
    whatsapp: '+5354019283',
    phone: '+5378304412',
    rating: 4.7,
    reviewsCount: 93,
    photos: [
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80'
    ],
    featured: true,
    status: 'active'
  },
  {
    id: 'biz-8',
    name: 'Boutique & Calzado Miramar Style',
    category: 'ropa',
    categoryIcon: 'Shirt',
    description: 'Prendas de vestir casuales, calzado deportivo importado, mochilas, carteras y accesorios.',
    province: 'La Habana',
    municipality: 'Playa',
    neighborhood: 'Miramar',
    address: 'Avenida 3ra #4208 e/ 42 y 44, Miramar',
    lat: 23.1235,
    lng: -82.4219,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: true,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 45 min',
    lastUpdatedDate: new Date(Date.now() - 45 * 60000).toISOString(),
    confirmationsCount: 31,
    reportsCount: 0,
    hours: '10:00 — 19:00',
    whatsapp: '+5353112233',
    phone: '+5372049988',
    rating: 4.9,
    reviewsCount: 34,
    photos: [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80'
    ],
    featured: false,
    status: 'active'
  },
  {
    id: 'biz-9',
    name: 'Restaurante El Rincón Holguinero',
    category: 'comida',
    categoryIcon: 'Utensils',
    description: 'Comida criolla oriental, lechón asado, congrí tradicional, tostones rellenos y coctelería nacional.',
    province: 'Holguín',
    municipality: 'Holguín',
    neighborhood: 'Centro',
    address: 'Calle Maceo #184 e/ Martí y Luz Caballero',
    lat: 20.8885,
    lng: -76.2625,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 20 min',
    lastUpdatedDate: new Date(Date.now() - 20 * 60000).toISOString(),
    confirmationsCount: 41,
    reportsCount: 0,
    hours: '12:00 — 23:00',
    whatsapp: '+5352994411',
    phone: '+5324423311',
    rating: 4.8,
    reviewsCount: 45,
    photos: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'
    ],
    featured: true,
    status: 'active'
  },
  {
    id: 'biz-10',
    name: 'Farmacia San Antonio Santiago',
    category: 'farmacias',
    categoryIcon: 'Pill',
    description: 'Farmacia con atención esmerada, medicamentos autorizados y medicina natural y tradicional.',
    province: 'Santiago de Cuba',
    municipality: 'Santiago de Cuba',
    neighborhood: 'Centro Histórico',
    address: 'Calle Enramadas #302 esq. Carnicería',
    lat: 20.0215,
    lng: -75.8279,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 1 hora',
    lastUpdatedDate: new Date(Date.now() - 60 * 60000).toISOString(),
    confirmationsCount: 52,
    reportsCount: 1,
    hours: '08:00 — 20:00',
    whatsapp: '+5353887711',
    phone: '+5322651122',
    rating: 4.6,
    reviewsCount: 39,
    photos: [
      'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=600&q=80'
    ],
    featured: false,
    status: 'active'
  },
  {
    id: 'biz-11',
    name: 'Minimarket La Bahía Matanzas',
    category: 'tiendas',
    categoryIcon: 'ShoppingBag',
    description: 'Abarrotes, enlatados, confitería, artículos de limpieza para el hogar y bebidas.',
    province: 'Matanzas',
    municipality: 'Matanzas',
    neighborhood: 'Pueblo Nuevo',
    address: 'Calle Milanés #54 e/ 2 de Mayo y Manzaneda',
    lat: 23.0425,
    lng: -81.5761,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: true,
    lastStatusUpdate: 'Hace 10 min',
    lastUpdatedDate: new Date(Date.now() - 10 * 60000).toISOString(),
    confirmationsCount: 27,
    reportsCount: 0,
    hours: '08:30 — 20:00',
    whatsapp: '+5352441100',
    phone: '+5345241199',
    rating: 4.5,
    reviewsCount: 23,
    photos: [
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=600&q=80'
    ],
    featured: false,
    status: 'active'
  },
  {
    id: 'biz-pending-demo',
    name: 'Cafetería & Desayunos El Malecón',
    category: 'cafeterias',
    categoryIcon: 'Coffee',
    description: 'Café cubano expreso, sándwiches tostados, batidos naturales y repostería artesanal recién horneada.',
    province: 'La Habana',
    municipality: 'Plaza de la Revolución',
    neighborhood: 'Vedado',
    address: 'Calle Línea esq. Malecón #102',
    lat: 23.1415,
    lng: -82.4010,
    acceptsTransfer: true,
    transferActiveNow: true,
    transferDetails: {
      transfermovil: true,
      enzona: true,
      qrPayment: true,
      onlineGateway: false,
      cash: true
    },
    transferVerified: false,
    lastStatusUpdate: 'Enviado recientemente (Pendiente de aprobación)',
    lastUpdatedDate: new Date().toISOString(),
    confirmationsCount: 1,
    reportsCount: 0,
    hours: '07:30 — 19:00',
    whatsapp: '+5353123456',
    phone: '+5378330012',
    rating: 4.9,
    reviewsCount: 2,
    photos: [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80'
    ],
    featured: false,
    status: 'pending'
  }
];

// Haversine distance calculator in meters
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
