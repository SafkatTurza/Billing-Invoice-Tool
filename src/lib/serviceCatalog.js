// ─────────────────────────────────────────────────────────────────────────────
// Standard Service / Item catalog.
//
// A curated starter set of DreamCore's reusable services, with a category and a
// standard description each. Deliberately NO pricing — rates vary per
// client/project and are always entered on the document.
//
// This is offered as an opt-in, non-destructive "Load Standard Services" action
// in Settings → Service / Item Library. Loading it only appends services whose
// name isn't already present (case-insensitive), so existing records — and any
// the user added, edited, or deleted — are never touched. It is NOT demo data:
// loaded services are permanent and unaffected by "Reset Demo Data".
// ─────────────────────────────────────────────────────────────────────────────

export const STANDARD_SERVICES = [
  // ── 3D ──────────────────────────────────────────────────────────────────
  {
    name: '3D Asset Development',
    category: '3D',
    description:
      'Creation of optimized 3D assets based on provided references and project requirements.',
  },
  {
    name: '3D Modeling',
    category: '3D',
    description:
      'Creation of detailed 3D models based on provided drawings, images, scans, or references.',
  },
  {
    name: '3D Product Modeling',
    category: '3D',
    description:
      'Creation of accurate 3D product models based on product references and specifications.',
  },
  {
    name: '3D Asset Optimization',
    category: '3D',
    description:
      'Optimization and correction of existing 3D assets for target platforms and applications.',
  },
  {
    name: '3D Animation',
    category: '3D',
    description:
      'Creation of 3D animations based on approved assets, storyboard, and project requirements.',
  },
  {
    name: '3D Scanning',
    category: '3D',
    description:
      'On-site 3D scanning, data capture, and processing for digital asset or environment creation.',
  },
  {
    name: 'Render-Ready Asset Preparation',
    category: '3D',
    description: 'Preparation and optimization of 3D assets for rendering and production use.',
  },

  // ── AR/VR ───────────────────────────────────────────────────────────────
  {
    name: 'AR App Development',
    category: 'AR/VR',
    description: 'Development of augmented reality applications and interactive AR experiences.',
  },
  {
    name: 'VR App Development',
    category: 'AR/VR',
    description: 'Development of virtual reality applications and immersive VR experiences.',
  },
  {
    name: 'AR/VR App Development',
    category: 'AR/VR',
    description:
      'Development of interactive augmented and virtual reality applications based on project requirements.',
  },

  // ── Virtual Tour ────────────────────────────────────────────────────────
  {
    name: 'Virtual Tour Development',
    category: 'Virtual Tour',
    description:
      'Development of interactive virtual tours using 360° imagery, 3D scans, or rendered environments.',
  },
  {
    name: 'Virtual Tour Pre-production',
    category: 'Virtual Tour',
    description: 'Project planning, site preparation, and image or environment capture.',
  },
  {
    name: 'Virtual Tour Post-production',
    category: 'Virtual Tour',
    description:
      'Image processing, staging, optimization, and content integration for virtual tours.',
  },

  // ── Software ────────────────────────────────────────────────────────────
  {
    name: 'App Development',
    category: 'Software',
    description:
      'Custom application development based on approved technical and functional requirements.',
  },
  {
    name: 'Unity App Development',
    category: 'Software',
    description: 'Development of interactive applications using the Unity engine.',
  },
  {
    name: 'iOS App Development',
    category: 'Software',
    description: 'Design and development of applications for Apple iOS devices.',
  },
  {
    name: 'Web Application Development',
    category: 'Software',
    description:
      'Development of secure and scalable web applications based on business requirements.',
  },
  {
    name: 'Website Development',
    category: 'Web',
    description: 'Design and development of responsive websites based on approved requirements.',
  },
  {
    name: 'Website Development with Custom CMS',
    category: 'Web',
    description:
      'Website development with a custom content management system for managing website content.',
  },
  {
    name: 'CMS Development',
    category: 'Software',
    description:
      'Development of a content management system for managing application or website content.',
  },
  {
    name: 'API & System Integration',
    category: 'Software',
    description:
      'Integration of APIs, third-party services, backend systems, and external platforms.',
  },
  {
    name: 'Product Configurator Development',
    category: 'Software',
    description:
      'Development of interactive 2D or 3D product configuration and customization solutions.',
  },
  {
    name: 'Kiosk App Development',
    category: 'Software',
    description: 'Development of interactive applications optimized for touchscreen kiosk systems.',
  },

  // ── Hardware ────────────────────────────────────────────────────────────
  {
    name: 'Custom Kiosk',
    category: 'Hardware',
    description:
      'Design, fabrication, assembly, and finishing of custom kiosk hardware based on specifications.',
  },

  // ── QA ──────────────────────────────────────────────────────────────────
  {
    name: 'QA & Testing',
    category: 'QA',
    description:
      'Functional testing, quality assurance, issue reporting, and verification of project deliverables.',
  },

  // ── Professional Service ────────────────────────────────────────────────
  {
    name: 'Project Management',
    category: 'Professional Service',
    description:
      'Project planning, coordination, communication, resource allocation, documentation, and delivery management.',
  },

  // ── Design ──────────────────────────────────────────────────────────────
  {
    name: 'UI/UX Design',
    category: 'Design',
    description:
      'User interface and user experience design based on project requirements and target platforms.',
  },

  // ── Media ───────────────────────────────────────────────────────────────
  {
    name: 'Video Editing & Post-production',
    category: 'Media',
    description: 'Video editing, processing, enhancement, and post-production services.',
  },
  {
    name: 'Audio Editing',
    category: 'Media',
    description: 'Audio editing, cleanup, processing, and production services.',
  },
  {
    name: 'Dubbing',
    category: 'Media',
    description: 'Voice recording and dubbing services based on provided scripts and requirements.',
  },

  // ── Support ─────────────────────────────────────────────────────────────
  {
    name: 'Maintenance & Support',
    category: 'Support',
    description:
      'Ongoing technical maintenance, issue resolution, updates, and application support.',
  },
  {
    name: 'Server Maintenance',
    category: 'Support',
    description:
      'Server health monitoring, security checks, maintenance, and related cloud infrastructure support.',
  },

  // ── Technical ───────────────────────────────────────────────────────────
  {
    name: 'Deployment',
    category: 'Technical',
    description:
      'Application or system deployment, configuration, and production environment setup.',
  },
  {
    name: 'Documentation',
    category: 'Professional Service',
    description:
      'Preparation of user manuals, technical documentation, and project-related documentation.',
  },
  {
    name: 'App Transfer',
    category: 'Technical',
    description: 'Transfer of applications between supported developer or platform accounts.',
  },

  // ── Resource ────────────────────────────────────────────────────────────
  {
    name: 'Development Resource',
    category: 'Resource',
    description:
      'Dedicated development resource assigned based on agreed project requirements and duration.',
  },
  {
    name: '3D Artist Resource',
    category: 'Resource',
    description:
      'Dedicated 3D artist assigned based on agreed project requirements and duration.',
  },
  {
    name: 'QA Engineer Resource',
    category: 'Resource',
    description: 'Dedicated QA engineer assigned for testing and quality assurance activities.',
  },
  {
    name: 'Project Manager Resource',
    category: 'Resource',
    description:
      'Dedicated project manager assigned for project planning, coordination, and delivery management.',
  },
]
