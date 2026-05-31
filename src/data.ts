import { Product } from "./types";

export const PRESET_REVIEWS = [
  {
    id: "rev-1",
    author: "Sofía M. - Rosario, Santa Fe",
    rating: 5,
    comment: "Llegó todo excelente. El embalaje de la Lámpara Alba Aura fue súper cuidadoso y la calidad superó mis expectativas. Queda hermosa en el living.",
    date: "Ayer"
  },
  {
    id: "rev-2",
    author: "Hernán G. - San Lorenzo",
    rating: 5,
    comment: "Súper recomendado. Compré el SILLÓN Bouclé y es una locura la comodidad y la textura. Envío rapidísimo y atención de 10.",
    date: "Hace 3 días"
  },
  {
    id: "rev-3",
    author: "Martina V. - Granadero Baigorria",
    rating: 4,
    comment: "Entrega a tiempo. Las Copas de Cristal Humo tienen un diseño finísimo, muy sofisticado. Ideal para regalar o regalarse.",
    date: "Hace una semana"
  },
  {
    id: "rev-4",
    author: "Clara S. - Rosario Centro",
    rating: 5,
    comment: "Excelente servicio de atención al cliente. Me asesoraron por Instagram antes de comprar y todo salió impecable.",
    date: "Hace 2 semanas"
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-contadora-billetes",
    title: "Contadora de Billetes Profesional con Detector Falsos",
    description: "Llevá la tranquilidad y el control de tus finanzas al siguiente nivel. Cuenta fajos con absoluta velocidad y precisión e integra sistemas avanzados de detección UV/MG para billetes sospechosos de forma automática.",
    basePrice: 139777,
    beforePrice: 154789,
    category: "Hogar",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1564982752979-3f7bc974d29a?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Cuenta hasta 1000 billetes por minuto de forma silenciosa y precisa.",
      "Detección ultravioleta (UV) y magnética (MG) integrada para máxima seguridad.",
      "Pantalla digital LED de alta resolución para conteo y control claro.",
      "Función de loteo y suma (batch/add) para armar fajos con facilidad."
    ],
    reviews: [
      {
        id: "rev-contadora-1",
        author: "Rodrigo F. - Rosario",
        rating: 5,
        comment: "Un antes y un después para mi local. Cuenta rapidísimo y el sensor de billetes falsos me ahorró más de un dolor de cabeza. Muy recomendable.",
        date: "Ayer"
      }
    ],
    featured: true
  },
  {
    id: "prod-reflector-solar",
    title: "Reflector Solar LED Exterior Potente con Sensor",
    description: "¿Querés ver tus espacios exteriores siempre iluminados y seguros sin gastar un solo peso en la factura eléctrica? Con reflector solar LED de alta eficiencia, sensor crepuscular y de cercanía automático.",
    basePrice: 169334,
    beforePrice: 186788,
    category: "Iluminación",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Cero costo de electricidad: se alimenta 100% con energía solar sustentable.",
      "Sensor de movimiento inteligente PIR con alcance de hasta 8 metros.",
      "Resistencia extrema a la intemperie con certificación impermeable IP65.",
      "Batería de litio recargable de alta duración de 2200mAh incorporada."
    ],
    reviews: [
      {
        id: "rev-reflector-1",
        author: "Maximiliano T. - Funes",
        rating: 5,
        comment: "Excelente potencia para el patio. Ideal que no requiera cables, lo instalé en 5 minutos y al detectar movimiento ilumina todo impecable.",
        date: "Hace 4 días"
      }
    ],
    featured: true
  },
  {
    id: "prod-bolso-carrito-compras",
    title: "Bolso Carrito de Compras Plegable con Ruedas",
    description: "Olvidate por completo de cargar peso y complicarte al hacer tus compras diarias. Este práctico bolso de lona impermeable incluye ruedas plegables ultra resistentes para un transporte sumamente cómodo.",
    basePrice: 19850,
    beforePrice: 24900,
    category: "Hogar",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Estructura plegable que se convierte de bolso de mano a carrito en segundos.",
      "Ruedas reforzadas con rulemanes para un deslizamiento suave y sin esfuerzo.",
      "Tela de lona oxford impermeable de alta densidad y fácil lavado.",
      "Capacidad de carga superior a los 15 kg sin deformarse."
    ],
    reviews: [
      {
        id: "rev-bolso-1",
        author: "Norma G. - Rosario Centro",
        rating: 5,
        comment: "Súper liviano y práctico. Lo uso para ir a la verdulería y me salvó la espalda. Al terminar lo pliego y no ocupa nada.",
        date: "Hace una semana"
      }
    ],
    featured: false
  },
  {
    id: "prod-set-juegos-mesa",
    title: "Set de Juegos de Mesa Madera 3 en 1",
    description: "Compartir momentos únicos con los tuyos nunca pasa de moda. Este set compacto de alta calidad reúne ludo, damas y ajedrez para divertirse sin pantallas en cualquier lugar.",
    basePrice: 24500,
    beforePrice: 32000,
    category: "Niños",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Tablero de madera premium bifaz con acabados finos y suaves al tacto.",
      "Fichas magnéticas de madera tallada listas para horas de juego.",
      "Compartimento interno acolchado para guardar todas las piezas de forma segura.",
      "El regalo perfecto para incentivar la estrategia en familia."
    ],
    reviews: [
      {
        id: "rev-juegos-1",
        author: "Florencia S. - San Lorenzo",
        rating: 5,
        comment: "La calidad de la madera es espectacular. Los chicos se engancharon al instante y las piezas quedan bien guardadas adentro del maletín.",
        date: "Hace 3 días"
      }
    ],
    featured: false
  },
  {
    id: "prod-lampara-mesa-rgb",
    title: "Lámpara de Mesa RGB Conexión Inteligente Aura",
    description: "Transformá por completo la atmósfera de tus espacios con un abanico infinito de colores y tonos cálidos. Perfecta para ambientar tus momentos de relax, lectura o trabajo.",
    basePrice: 38234,
    beforePrice: 44351,
    category: "Iluminación",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "16 millones de colores ajustables y control de calidez de luz blanca (3000K - 6500K).",
      "Control táctil directo en la base o mediante asistente inteligente de voz y app móvil.",
      "Modo ritmo musical que sincroniza los destellos con tus canciones o películas favoritas.",
      "Alimentación USB directa y bajo consumo energético con tecnología LED Aura."
    ],
    reviews: [
      {
        id: "rev-lampara-1",
        author: "Carla D. - Rosario",
        rating: 5,
        comment: "Los colores son divinos y los modos de relajación ayudan un montón para antes de dormir. La manejo toda con el teléfono.",
        date: "Hace 2 semanas"
      }
    ],
    featured: false
  },
  {
    id: "prod-set-accesorios-bano",
    title: "Soporte de Baño y Set de Accesorios Premium",
    description: "¿Querés darle un toque de distinción y originalidad a tu baño? Este juego de accesorios de cerámica mate y detalles en bambú nórdico organiza tu espacio con máxima elegancia.",
    basePrice: 9486,
    beforePrice: 14378,
    category: "Hogar",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Material cerámico premium de alta resistencia con acabado mate texturado.",
      "Detalles y bases de bambú natural tratado contra la humedad e impermeabilizado.",
      "Incluye dispenser de jabón con pico dosificador, portacepillos y jabonera.",
      "Estilo minimalista nórdico que eleva instantáneamente la estética del baño."
    ],
    reviews: [
      {
        id: "rev-bano-1",
        author: "Bautista K. - Granadero Baigorria",
        rating: 5,
        comment: "Precioso. Le dio un toque súper pro y ordenado al antebaño. La cerámica tiene una textura muy linda.",
        date: "Hace 2 días"
      }
    ],
    featured: false
  },
  {
    id: "prod-cafetera-expreso-vintage",
    title: "Cafetera Expreso Vintage Black Premium 20 Bar",
    description: "¿Hay algo más lindo que despertarte con el aroma del café recién hecho inundando tu cocina? Con nuestra Cafetera Expresso Vintage de 20 Bar y vaporizador de leche integrado, prepará espressos, cappuccinos y lattes de barista profesional.",
    basePrice: 187144,
    beforePrice: 201245,
    category: "Cocina",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Bomba de presión italiana premium de 20 bares de fuerza para un espresso cremoso.",
      "Vaporizador espumador ajustable para preparar lattes y capuchinos perfectos.",
      "Estética única retro vintage con detalles analógicos y acabados cromados elegantísimos.",
      "Depósito de agua transparente desmontable con capacidad para 1.5 litros."
    ],
    reviews: [
      {
        id: "rev-cafetera-1",
        author: "Lucía M. - Alberdi",
        rating: 5,
        comment: "Súper feliz con esta cafetera. Además de que es hermosa y decora la cocina, la presión que tiene saca el café con una espumita increíble.",
        date: "Ayer"
      }
    ],
    featured: true
  },
  {
    id: "prod-set-almohada-cobertor",
    title: "Set Premium de Almohadilla y Cobertor",
    description: "Envolvé a tu bebé en un abrazo de pura suavidad. Confeccionado con materiales hipoalergénicos ultra blandos, este set incluye una almohadita ergonómica y un cobertor acolchado súper abrigado para asegurar su mejor descanso diario.",
    basePrice: 38710,
    beforePrice: 42647,
    category: "Niños",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Tejido extrasuave transpirable, óptimo para la piel sensible del recién nacido.",
      "Almohada ergonómica diseñada para prevenir la plagiocefalia postural.",
      "Manta cobertora de microfibra soft térmica extra abrigada y confortable.",
      "Hermosa presentación en maletín de regalo ecológico transparente."
    ],
    reviews: [
      {
        id: "rev-bebe-1",
        author: "Gimena L. - Rosario Centro",
        rating: 5,
        comment: "Súper suave y calentito. Lo compramos para el moisés de nuestro gordo y es hermoso el diseño. Súper abrigado.",
        date: "Hace 5 días"
      }
    ],
    featured: true
  }
];
