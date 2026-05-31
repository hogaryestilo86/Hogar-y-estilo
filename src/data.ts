import { Product } from "./types";

export const PRESET_REVIEWS = [
  {
    id: "rev-1",
    author: "Sofía M. - Rosario, Santa Fe",
    rating: 5,
    comment: "Llegó todo excelente. El embalaje del set de baño fue súper cuidadoso y la calidad superó mis expectativas. Queda hermoso.",
    date: "Ayer"
  },
  {
    id: "rev-2",
    author: "Hernán G. - San Lorenzo",
    rating: 5,
    comment: "Súper recomendado. Compré el organizador de madera y acero y es una locura la robustez y terminación. Envío rapidísimo y atención de 10.",
    date: "Hace 3 días"
  },
  {
    id: "rev-3",
    author: "Martina V. - Granadero Baigorria",
    rating: 4,
    comment: "Entrega a tiempo. El organizador tiene un diseño finísimo, muy sofisticado. Ideal para tener los ambientes prolijos.",
    date: "Hace una semana"
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-custom-1780134870480",
    title: "Set de Baño Premium de Cerámica con Dispenser y Jabonera",
    description: "Transformá tu baño en un verdadero spa de la mano de este set exclusivo. Pensá en ese momento del día donde buscás relajar y desconectar; con este kit de diseño no solo sumás funcionalidad, sino que vestís tus espacios con un diseño minimalista que transmite paz, calidez y orden desde el primer vistazo.\n\n**Detalles de Diseño**\n- **Materiales Nobles:** Elaborado en cerámica seleccionada de alta resistencia con acabados satinados suaves al tacto.\n- **Dosificador de Precisión:** El dispenser cuenta con una válvula de accionamiento suave que evita derrames y optimiza el uso.\n- **Armonía Estética:** Un dúo diseñado en perfecta sintonía para elevar la decoración de tu vanitory.\n- **Higiene y Durabilidad:** Superficies no porosas que facilitan una limpieza rápida y efectiva.\n\nDale a tu hogar ese toque de distinción y practicidad que te merecés. ¡Renová tus rincones cotidianos hoy mismo!",
    basePrice: 28945,
    beforePrice: 34769,
    category: "Hogar",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=85"
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "set de baño premium",
      "dispenser de jabon ceramica",
      "jabonera nordica elegante",
      "accesorios de baño rosario",
      "decoracion de baños minimalistas",
      "kit de baño de lujo"
    ],
    reviews: [
      {
        id: "rev-auto-1780134870480",
        author: "Curador de Hogar y Estilo",
        rating: 5,
        comment: "Nuevo ingreso seleccionado minuciosamente por nuestro departamento de diseño.",
        date: "Hoy"
      }
    ],
    isCustom: true,
    featured: false
  },
  {
    id: "prod-custom-1780133237028",
    title: "Carrito Organizador Multiuso Minimalista con Ruedas Pivotantes",
    description: "Optimice sus espacios con la sofisticación y versatilidad que solo el Carrito Auxiliar de Hogar y Estilo puede ofrecer. Diseñado para quienes valoran el orden sin comprometer la estética, este organizador móvil se adapta con naturalidad a su cocina, estudio o sala de estar, aportando un toque contemporáneo y funcional.\n\n**Detalles de Diseño**\n- **Movilidad Fluida**: Equipado con 4 ruedas pivotantes de alta resistencia que se desplazan silenciosamente sin dañar sus pisos.\n- **Materiales de Primera**: Estructura robusta de metal reforzado con acabados de pintura epoxi mate para mayor durabilidad.\n- **Espacio Optimizado**: Múltiples niveles con estantes de gran capacidad para mantener todo a mano y clasificado.\n- **Estilo Versátil**: Su silueta minimalista complementa cualquier estilo decorativo, desde el moderno hasta el industrial.\n\nEleve la organización de sus ambientes cotidianos con una pieza clave que fusiona practicidad y distinción.",
    basePrice: 75945,
    category: "Cocina",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "carrito organizador industrial",
      "carrito auxiliar con ruedas",
      "mueble organizador móvil",
      "estantería rodante premium",
      "orden del hogar elegante",
      "carrito multiuso cocina"
    ],
    reviews: [
      {
        id: "rev-auto-1780133237028",
        author: "Curador de Hogar y Estilo",
        rating: 5,
        comment: "Nuevo ingreso seleccionado minuciosamente por nuestro departamento de diseño.",
        date: "Hoy"
      }
    ],
    isCustom: true,
    featured: false
  },
  {
    id: "prod-custom-1780085867670",
    title: "Organizador de Tres Niveles Premium en Madera Maciza y Acero",
    description: "Transformá la armonía de tu hogar con una pieza que redefine el concepto de orden y sofisticación. Diseñado exclusivamente para quienes valoran la belleza de la funcionalidad, este organizador de tres niveles aporta una distinción única a cualquier rincón, logrando que la organización diaria se convierta en una experiencia estética inigualable.\n\n**Detalles de Diseño**\n\n* **Materiales de Nobleza Excepcional:** Combinación perfecta de madera maciza seleccionada con acabado natural y una estructura de acero templado con pintura microtexturada mate.\n* **Capacidad y Versatilidad de Tres Niveles:** Ideal para optimizar espacios en tu cocina, baño, escritorio o sala de estar, manteniendo la accesibilidad con un diseño esbelto.\n* **Estabilidad y Durabilidad Premium:** Su sólida construcción garantiza una resistencia superior al desgaste y un soporte firme para tus objetos más preciados.\n* **Estilo Minimalista Atemporal:** Una fusión orgánica que se adapta perfectamente a decoraciones nórdicas, japandi o industriales modernas.\n\nDale a tu hogar el equilibrio visual que merece. Sumá esta pieza exclusiva de Hogar y Estilo a tus ambientes y experimentá la perfecta sintonía entre funcionalidad y diseño de autor.",
    basePrice: 51785,
    category: "Cocina",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=800&q=85"
      }
    ],
    features: [
      "organizador de tres niveles",
      "estantería de madera maciza",
      "organizador premium minimalista",
      "decoración hogar y estilo",
      "estante multiuso nórdico",
      "muebles de diseño exclusivo"
    ],
    reviews: [
      {
        id: "rev-auto-1780085867670",
        author: "Curador de Hogar y Estilo",
        rating: 5,
        comment: "Nuevo ingreso seleccionado minuciosamente por nuestro departamento de diseño.",
        date: "Hoy"
      }
    ],
    isCustom: true,
    featured: true
  }
];
