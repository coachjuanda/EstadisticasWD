// Seed de un solo uso: crea las 2 plantillas de encuesta reales (clima
// deportivo y emocional, para jugadores y para padres) vía el motor genérico
// de survey_templates/survey_questions. Idempotente: si una plantilla con el
// mismo título y target ya existe, no la vuelve a crear.
// Corre con: node --env-file=.env.local scripts/seed-survey-templates.mjs
// Requiere SUPABASE_SERVICE_ROLE_KEY (bypassa RLS a propósito, solo para
// este seed inicial -- nunca se usa así desde la app en producción).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ESCALA_1_5 = { question_type: 'escala', scale_min: 1, scale_max: 5, is_required: true };

const TEMPLATES = [
  {
    title: 'Encuesta de Clima Deportivo y Emocional — Jugadores',
    target: 'deportista',
    description:
      'Para jugadores mayores de 12 años. Esta encuesta es confidencial y busca entender cómo te sientes en los entrenamientos y torneos. Responde con sinceridad, no hay respuestas correctas o incorrectas.',
    questions: [
      { ...ESCALA_1_5, question_text: 'Llego al entrenamiento con energía y ganas de aprender.' },
      {
        ...ESCALA_1_5,
        question_text:
          'Cuando cometo un error en un torneo, logro recuperarme rápido sin frustrarme.',
      },
      {
        question_type: 'opcion_multiple',
        question_text: '¿Qué emoción predomina en ti durante un torneo?',
        options: ['Alegría', 'Nervios', 'Concentración', 'Miedo a fallar'],
        is_required: true,
      },
      {
        ...ESCALA_1_5,
        question_text:
          'Me siento cómodo/a expresando mis emociones (frustración, tristeza, alegría) frente a mi entrenador.',
      },
      {
        ...ESCALA_1_5,
        question_text:
          'Siento que mi toma de decisiones dentro de la cancha/pista ha mejorado en el último mes.',
      },
      {
        ...ESCALA_1_5,
        question_text: 'Entiendo claramente qué espera de mí mi entrenador en mi rol o posición.',
      },
      {
        question_type: 'opcion_multiple',
        question_text: '¿Cuál crees que es tu mayor prioridad para mejorar?',
        options: [
          'Control de disco en velocidad',
          'Definición',
          'Marcaje y retroceso defensivo (back check)',
          'Recepción orientada',
          'Comunicación táctica con mi línea',
        ],
        is_required: true,
      },
      {
        question_type: 'texto_libre',
        question_text:
          'Escribe una acción concreta que vas a intentar mejorar en el próximo mes de entrenamientos (ej: "mirar hacia arriba antes de recibir").',
        is_required: true,
      },
      {
        ...ESCALA_1_5,
        question_text:
          'Como equipo, necesitamos trabajar más en jugadas de estrategia y en nuestra comunicación dentro del campo.',
      },
      {
        question_type: 'texto_libre',
        question_text:
          '¿Qué extrañas del equipo en los momentos difíciles del partido? (ej: falta de un líder, poca claridad táctica, etc.)',
        is_required: true,
      },
    ],
  },
  {
    title: 'Encuesta de Clima Deportivo y Emocional — Padres',
    target: 'padre',
    description:
      'Esta encuesta es confidencial y busca conocer su percepción como padre/madre sobre la experiencia deportiva y emocional de su hijo/a. Sus respuestas nos ayudan a mejorar.',
    questions: [
      {
        ...ESCALA_1_5,
        question_text:
          'Veo a mi hijo/a disfrutando genuinamente mientras practica (sonrisas, gestos positivos).',
      },
      {
        ...ESCALA_1_5,
        question_text:
          'Mi hijo/a maneja la presión de los torneos de manera saludable (no se derrumba tras un gol en contra).',
      },
      {
        question_type: 'texto_libre',
        question_text:
          '¿Cómo describiría el lenguaje corporal de su hijo/a cuando el entrenador le da indicaciones? (Ej: abierto/receptivo o cansado/desconectado)',
        is_required: true,
      },
      {
        ...ESCALA_1_5,
        question_text: 'Siento que el entrenador conoce y entiende a mi hijo/a más allá de lo deportivo.',
      },
      {
        ...ESCALA_1_5,
        question_text:
          'Noto que mi hijo/a ha mejorado su inteligencia de juego (sabe dónde posicionarse) en comparación al inicio de la temporada.',
      },
      {
        question_type: 'texto_libre',
        question_text:
          '¿Qué habilidad blanda (no técnica) ha notado que creció en su hijo/a? (Ej: responsabilidad, resiliencia, compañerismo).',
        is_required: true,
      },
      {
        question_type: 'opcion_multiple',
        question_text: 'Según lo que observa, ¿en qué aspecto técnico ve mayor margen de mejora?',
        options: [
          'Fuerza en los disparos',
          'Agilidad y cambios de ritmo',
          'Juego sin disco / desmarques',
          'Uso del revés / lado débil',
        ],
        is_required: true,
      },
      {
        question_type: 'texto_libre',
        question_text:
          '¿Ha escuchado a su hijo/a quejarse o frustrarse por algún aspecto específico de su rendimiento? Descríbalo brevemente.',
        is_required: true,
      },
      {
        ...ESCALA_1_5,
        question_text:
          'La comunicación del cuerpo técnico hacia los padres sobre los objetivos y la logística del equipo es clara y constante.',
      },
      {
        question_type: 'escala',
        scale_min: 0,
        scale_max: 10,
        is_required: true,
        question_text:
          'En una escala de 0 a 10, ¿qué tan probable es que recomiende esta academia a otra familia?',
      },
      {
        question_type: 'texto_libre',
        question_text: 'Si quiere, agregue un breve comentario adicional (opcional).',
        is_required: false,
      },
    ],
  },
];

async function main() {
  const { data: admin, error: adminError } = await supabase
    .from('profiles')
    .select('id, club_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (adminError || !admin) {
    console.error('No se encontró un usuario admin para usar como created_by.', adminError?.message);
    process.exit(1);
  }

  for (const tpl of TEMPLATES) {
    const { data: existing } = await supabase
      .from('survey_templates')
      .select('id')
      .eq('title', tpl.title)
      .eq('target', tpl.target)
      .eq('club_id', admin.club_id)
      .maybeSingle();

    if (existing) {
      console.log(`Ya existía: "${tpl.title}" (${existing.id}). No se volvió a crear.`);
      continue;
    }

    const { data: template, error: templateError } = await supabase
      .from('survey_templates')
      .insert({
        title: tpl.title,
        target: tpl.target,
        description: tpl.description,
        club_id: admin.club_id,
        created_by: admin.id,
      })
      .select('id')
      .single();

    if (templateError) {
      console.error(`Error creando "${tpl.title}":`, templateError.message);
      process.exit(1);
    }

    const rows = tpl.questions.map((q, idx) => ({
      template_id: template.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? null,
      sort_order: idx + 1,
      scale_min: q.scale_min ?? 1,
      scale_max: q.scale_max ?? 5,
      is_required: q.is_required ?? true,
    }));

    const { error: questionsError } = await supabase.from('survey_questions').insert(rows);

    if (questionsError) {
      console.error(`Error creando preguntas de "${tpl.title}":`, questionsError.message);
      process.exit(1);
    }

    console.log(`Creada: "${tpl.title}" (${template.id}) con ${rows.length} preguntas.`);
  }
}

main();
