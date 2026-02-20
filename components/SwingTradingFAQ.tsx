import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import styles from '@/styles/SwingTradingFAQ.module.css';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const SwingTradingFAQ: React.FC = () => {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const faqData: FAQItem[] = [
    {
      id: 1,
      question: "¿A quién está dirigido este entrenamiento?",
      answer: "Zero2Trader está dirigido a personas que quieren aprender a invertir y operar en el mercado con criterio propio, sin depender de terceros.\n\nEs ideal tanto para quienes empiezan desde cero como para quienes ya operaron pero sienten que les falta método, gestión y control emocional.\n\nSi tu objetivo es construir autonomía real y pensar como un trader profesional, este programa es para vos."
    },
    {
      id: 2,
      question: "¿Qué voy a aprender?",
      answer: "Vas a recorrer un proceso completo en 3 niveles progresivos:\n\n- En StepOne vas a realizar tu primera inversión real con base técnica y mentalidad correcta.\n- En LevelUp vas a dominar el análisis técnico y aprender a construir tus propios setups.\n- En TraderPro vas a integrar estrategia swing, gestión de riesgo y psicotrading profesional.\n\nEl foco está puesto en priorizar el acompañamiento del alumno para que pueda aprender a pensar, estructurar y ejecutar con precisión en los mercados."
    },
    {
      id: 3,
      question: "¿Cómo es la modalidad?",
      answer: "El programa se desarrolla en formato intensivo con clases en vivo semanales, todos los sábados.\n\nCada nivel incluye 4 clases teórico-prácticas aplicadas sobre mercado real, ejercicios concretos y entrega de tareas con feedback.\n\nTodas las clases quedan grabadas y se envían para su repaso."
    },
    {
      id: 4,
      question: "¿Qué incluye la inscripción?",
      answer: "La inscripción incluye:\n\n- Acceso completo a los 3 niveles (StepOne, LevelUp y TraderPro).\n- Acceso gratuito y de por vida a todos los indicadores personalizados utilizados en TradingView.\n- Pack premium de recursos descargables (plan de trading, diario del trader, planillas, checklist y guías técnicas).\n- Comunidad privada de alumnos y una exclusiva por edición con feedback semanal.\n\nEl valor real del ecosistema completo supera los 500 USD, pero Z2T existe para formar traders profesionales. Por eso, bonificamos más del 40% del valor total únicamente a quienes se comprometen con todo el camino de transformación."
    },
    {
      id: 5,
      question: "¿Cuándo empieza y cómo reservo mi lugar?",
      answer: "Zero2Trader se organiza por ediciones mensuales con cupos limitados para garantizar seguimiento premium y feedback personalizado.\n\nPara reservar tu lugar simplemente debés completar la inscripción seleccionando el mes de inicio. Una vez confirmado el pago, recibís por mail la invitación al google meet de todas las clases, a los indicadores, recursos, comunidad y a toda la estructura del programa.\n\nSi estás listo para comprometerte con el proceso completo, el lugar es tuyo."
    }
  ];

  const toggleItem = (itemId: number) => {
    setOpenItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isOpen = (itemId: number) => openItems.includes(itemId);

  return (
    <section className={styles.faqSection}>
      <div className={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className={styles.faqTitle}>
            Preguntas Frecuentes
          </h2>
          <p className={styles.faqSubtitle}>
            Todo lo que necesitás saber sobre el entrenamiento de Zero 2 Trader
          </p>
          
          <div className={styles.faqContainer}>
            {faqData.map((item, index) => (
              <motion.div
                key={item.id}
                className={styles.faqItem}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <button
                  className={`${styles.faqQuestion} ${isOpen(item.id) ? styles.faqQuestionOpen : ''}`}
                  onClick={() => toggleItem(item.id)}
                  aria-expanded={isOpen(item.id)}
                >
                  <span className={styles.faqQuestionText}>
                    {item.question}
                  </span>
                  <span className={styles.faqIcon}>
                    {isOpen(item.id) ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </span>
                </button>
                
                <AnimatePresence>
                  {isOpen(item.id) && (
                    <motion.div
                      className={styles.faqAnswerContainer}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className={styles.faqAnswer}>
                        {item.answer.split('\n\n').map((block, blockIdx) => {
                          const lines = block.split('\n');
                          const listItems = lines.filter(l => l.trim().startsWith('- '));
                          if (listItems.length > 0) {
                            const intro = lines.filter(l => !l.trim().startsWith('- ')).join('\n');
                            return (
                              <div key={blockIdx}>
                                {intro && <p>{intro.trim()}</p>}
                                <ul>
                                  {listItems.map((li, liIdx) => (
                                    <li key={liIdx}>{li.replace(/^- /, '').trim()}</li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }
                          return <p key={blockIdx}>{block}</p>;
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SwingTradingFAQ;
