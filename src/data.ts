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
    id: "prod-alba-aura",
    title: "Velador Nórdico de Mesa Alba Aura",
    description: "Un velador diseñado con sutiles curvas de madera natural de fresno seleccionada y una pantalla de hilo tejida a mano que difunde una luz cálida y orgánica. Ideal para transformar cualquier mesa de luz o escritorio en un oasis de serenidad.",
    basePrice: 38500,
    beforePrice: 48000,
    category: "Iluminación",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=85"
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Base de madera natural premium tratada con aceites ecológicos.",
      "Pantalla de hilo de algodón de alta resistencia.",
      "Interruptor de mano de diseño moderno integrado.",
      "Compatible con lámparas LED bajo consumo de calidez regulable."
    ],
    reviews: [PRESET_REVIEWS[0]],
    featured: true
  },
  {
    id: "prod-utensilios-bambu",
    title: "Set de Utensilios de Cocina Bambú Natural Orgánico",
    description: "Conjunto de 5 herramientas esenciales de cocina fabricadas íntegramente de bambú de crecimiento certificado. Su dureza natural es altamente superior a las maderas tradicionales, protegiendo tus sartenes antiadherentes y aportando un aire fresco y rústico a tu mesada.",
    basePrice: 19500,
    beforePrice: 26000,
    category: "Cocina",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=85"
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1581084324492-c8076f130f86?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Fabricación artesanal libre de melaminas y pegamentos tóxicos.",
      "Antibacteriano y repelente de olores de manera natural.",
      "No raya revestimientos de cerámica o teflón.",
      "Incluye recipiente organizador cilíndrico de diseño contemporáneo."
    ],
    reviews: [PRESET_REVIEWS[1]],
    featured: true
  },
  {
    id: "prod-sillon-boucle",
    title: "Sillón de Lectura Bouclé Confort",
    description: "Sillón individual tapizado con la exclusiva tela bouclé (ovejita), conocida por su textura sumamente suave y su estética de vanguardia europea. Su estructura acolchada y ergonómica te abraza en cada momento de lectura.",
    basePrice: 145000,
    beforePrice: 180000,
    category: "Hogar",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&q=85"
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Tapizado de textura bouclé ultrasuave de alta gramatura.",
      "Relleno de espuma de poliuretano de alta densidad con memoria y resiliencia.",
      "Patas cilíndricas en elegante terminación madera o metal negro satinado.",
      "Costuras de alta resistencia reforzadas."
    ],
    reviews: [PRESET_REVIEWS[2]],
    featured: true
  },
  {
    id: "prod-serum-rosa",
    title: "Serum Rejuvenecedor de Belleza Rosa Mosqueta",
    description: "Elixir facial hidratante formulado con extracto puro prensado en frío de semillas de Rosa Mosqueta patagónica y enriquecido con ácido hialurónico concentrado. Regenera el tejido, unifica el tono de la piel y aporta una luminosidad natural inolvidable.",
    basePrice: 16200,
    beforePrice: 22000,
    category: "Belleza",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "100% libre de parabenos, fragancias artificiales e ingredientes animales.",
      "Contiene Vitamina A, C y E que actúan como poderosos antioxidantes.",
      "Textura ligera de rápida absorción, no grasosa.",
      "Gotero dosificador de vidrio para una aplicación higiénica e integrada."
    ],
    reviews: [PRESET_REVIEWS[3]],
    featured: false
  },
  {
    id: "prod-organizador-negro",
    title: "Organizador Multifuncional Metálico Negro",
    description: "Repisa y organizador modular multiuso, ideal tanto para condimentos en la cocina como para toallas en el baño o herramientas en el taller. Fabricado de acero reforzado con pintura termoestable de alta duración, totalmente a prueba de óxido.",
    basePrice: 24500,
    beforePrice: 32000,
    category: "Herramientas",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "Chapa de acero soldada de alta rigidez estructural.",
      "Pintura en polvo electrostática negro microtexturado.",
      "Doble estante con barandas de contención anticaídas de alta eficiencia.",
      "Ganchos laterales de encastre integrados para repasadores o llaves."
    ],
    reviews: [],
    featured: false
  }
];
