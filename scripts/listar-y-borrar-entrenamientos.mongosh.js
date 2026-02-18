/*******************************
 * LISTAR Y BORRAR ENTRENAMIENTOS DE PRUEBA
 *
 * 1. Lista todos los entrenamientos y datos relacionados
 * 2. Permite borrarlos para empezar con pruebas reales
 *
 * Colecciones afectadas:
 * - monthlytrainings: Entrenamientos mensuales (Zero 2 Trader)
 * - monthlytrainingsubscriptions: Suscripciones de usuarios
 * - trainingdates: Fechas de clases
 * - trainingschedules: Horarios de entrenamientos
 * - trainings: Configuración de entrenamientos (solicitudes, horarios)
 * - bookings: Reservas de tipo 'training'
 *
 * Uso:
 *   mongosh "mongodb+srv://..." scripts/listar-y-borrar-entrenamientos.mongosh.js
 *
 * IMPORTANTE: Cambiar DRY_RUN a false para ejecutar la eliminación
 *******************************/

const DRY_RUN = true; // true = solo listar, false = eliminar

// Colecciones
const monthlyTrainingsColl = db.getCollection("monthlytrainings");
const monthlySubsColl = db.getCollection("monthlytrainingsubscriptions");
const trainingDatesColl = db.getCollection("trainingdates");
const trainingSchedulesColl = db.getCollection("trainingschedules");
const trainingsColl = db.getCollection("trainings");
const bookingsColl = db.getCollection("bookings");
const usersColl = db.getCollection("users");

// Si true, también vacía el array entrenamientos[] de cada usuario
const LIMPIAR_ENTRENAMIENTOS_EN_USUARIOS = true;

print("=== LISTAR Y BORRAR ENTRENAMIENTOS DE PRUEBA ===\n");
printjson({
  modo: DRY_RUN ? "DRY RUN (solo listar, NO eliminar)" : "ELIMINACIÓN REAL (se borrarán los datos)"
});

/****************************************
 * 1) Monthly Trainings (Entrenamientos mensuales)
 ****************************************/
print("\n=== 1) MONTHLY TRAININGS (Entrenamientos mensuales Zero 2 Trader) ===");

const monthlyTrainings = monthlyTrainingsColl.find({}).toArray();
print(`Total: ${monthlyTrainings.length}`);

monthlyTrainings.forEach((t, idx) => {
  print(`\n  [${idx + 1}] ID: ${t._id}`);
  print(`      Título: ${t.title || "N/A"}`);
  print(`      Mes/Año: ${t.month || "?"}/${t.year || "?"}`);
  print(`      Estado: ${t.status || "N/A"}`);
  print(`      Max estudiantes: ${t.maxStudents || "N/A"}`);
  print(`      Estudiantes inscritos: ${(t.students || []).length}`);
  print(`      Clases: ${(t.classes || []).length}`);
  print(`      Creado: ${t.createdAt || "N/A"}`);
});

/****************************************
 * 2) Monthly Training Subscriptions
 ****************************************/
print("\n=== 2) MONTHLY TRAINING SUBSCRIPTIONS (Suscripciones) ===");

const subscriptions = monthlySubsColl.find({}).toArray();
print(`Total: ${subscriptions.length}`);

subscriptions.forEach((s, idx) => {
  print(`\n  [${idx + 1}] ID: ${s._id}`);
  print(`      Usuario: ${s.userEmail || s.userName || "N/A"}`);
  print(`      Tipo: ${s.trainingType || "N/A"}`);
  print(`      Mes/Año: ${s.subscriptionMonth || "?"}/${s.subscriptionYear || "?"}`);
  print(`      Estado pago: ${s.paymentStatus || "N/A"}`);
  print(`      Activo: ${s.isActive}`);
  print(`      Creado: ${s.createdAt || "N/A"}`);
});

/****************************************
 * 3) Training Dates (Fechas de clases)
 ****************************************/
print("\n=== 3) TRAINING DATES (Fechas de clases) ===");

const trainingDates = trainingDatesColl.find({}).toArray();
print(`Total: ${trainingDates.length}`);

trainingDates.forEach((d, idx) => {
  print(`\n  [${idx + 1}] ID: ${d._id}`);
  print(`      Tipo: ${d.trainingType || "N/A"}`);
  print(`      Fecha: ${d.date || "N/A"} - ${d.time || "N/A"}`);
  print(`      Título: ${d.title || "N/A"}`);
  print(`      Activo: ${d.isActive}`);
  print(`      Creado por: ${d.createdBy || "N/A"}`);
});

/****************************************
 * 4) Training Schedules (Horarios)
 ****************************************/
print("\n=== 4) TRAINING SCHEDULES (Horarios) ===");

const schedules = trainingSchedulesColl.find({}).toArray();
print(`Total: ${schedules.length}`);

schedules.forEach((s, idx) => {
  print(`\n  [${idx + 1}] ID: ${s._id}`);
  print(`      Día: ${s.dayOfWeek} | Hora: ${s.hour}:${String(s.minute).padStart(2, "0")}`);
  print(`      Duración: ${s.duration} min`);
  print(`      Activo: ${s.activo}`);
});

/****************************************
 * 5) Trainings (Configuración general)
 ****************************************/
print("\n=== 5) TRAININGS (Configuración de entrenamientos) ===");

const trainings = trainingsColl.find({}).toArray();
print(`Total: ${trainings.length}`);

trainings.forEach((t, idx) => {
  print(`\n  [${idx + 1}] ID: ${t._id}`);
  print(`      Nombre: ${t.nombre || "N/A"}`);
  print(`      Tipo: ${t.tipo || "N/A"}`);
  print(`      Solicitudes: ${(t.solicitudes || []).length}`);
  print(`      Horarios: ${(t.horarios || []).length}`);
  print(`      Activo: ${t.activo}`);
});

/****************************************
 * 6) Bookings de tipo training
 ****************************************/
print("\n=== 6) BOOKINGS (Reservas de entrenamiento) ===");

const trainingBookings = bookingsColl.find({
  $or: [
    { type: "training" },
    { serviceType: "SwingTrading" }
  ]
}).toArray();
print(`Total: ${trainingBookings.length}`);

trainingBookings.forEach((b, idx) => {
  print(`\n  [${idx + 1}] ID: ${b._id}`);
  print(`      Usuario: ${b.userEmail || "N/A"}`);
  print(`      Tipo: ${b.type || "N/A"}`);
  print(`      ServiceType: ${b.serviceType || "N/A"}`);
  print(`      Fecha: ${b.startDate || "N/A"}`);
  print(`      Estado: ${b.status || "N/A"}`);
  print(`      Pago: ${b.paymentStatus || "N/A"}`);
});

/****************************************
 * 7) Usuarios con entrenamientos
 ****************************************/
print("\n=== 7) USUARIOS con array entrenamientos no vacío ===");

const usersConEntrenamientos = usersColl.find({
  entrenamientos: { $exists: true, $ne: [] }
}).toArray();
print(`Total: ${usersConEntrenamientos.length}`);

usersConEntrenamientos.forEach((u, idx) => {
  print(`\n  [${idx + 1}] Email: ${u.email || "N/A"}`);
  print(`      Entrenamientos: ${(u.entrenamientos || []).length}`);
});

/****************************************
 * RESUMEN
 ****************************************/
print("\n=== RESUMEN TOTAL ===");
const totalDocs =
  monthlyTrainings.length +
  subscriptions.length +
  trainingDates.length +
  schedules.length +
  trainings.length +
  trainingBookings.length;

print(`  - Monthly Trainings: ${monthlyTrainings.length}`);
print(`  - Subscriptions: ${subscriptions.length}`);
print(`  - Training Dates: ${trainingDates.length}`);
print(`  - Training Schedules: ${schedules.length}`);
print(`  - Trainings: ${trainings.length}`);
print(`  - Training Bookings: ${trainingBookings.length}`);
print(`  - Usuarios con entrenamientos a limpiar: ${usersConEntrenamientos.length}`);
print(`  TOTAL documentos a eliminar: ${totalDocs}`);
if (LIMPIAR_ENTRENAMIENTOS_EN_USUARIOS && usersConEntrenamientos.length > 0) {
  print(`  + Usuarios a actualizar (vaciar entrenamientos): ${usersConEntrenamientos.length}`);
}

/****************************************
 * ELIMINACIÓN (solo si DRY_RUN = false)
 ****************************************/
if (!DRY_RUN && totalDocs > 0) {
  print("\n=== EJECUTANDO ELIMINACIÓN ===");

  let deleted = 0;
  let errors = 0;

  // 1. Bookings de training
  if (trainingBookings.length > 0) {
    const r = bookingsColl.deleteMany({
      $or: [{ type: "training" }, { serviceType: "SwingTrading" }]
    });
    deleted += r.deletedCount;
    print(`  ✅ Bookings eliminados: ${r.deletedCount}`);
  }

  // 2. Monthly Training Subscriptions
  if (subscriptions.length > 0) {
    const r = monthlySubsColl.deleteMany({});
    deleted += r.deletedCount;
    print(`  ✅ Subscriptions eliminadas: ${r.deletedCount}`);
  }

  // 3. Monthly Trainings
  if (monthlyTrainings.length > 0) {
    const r = monthlyTrainingsColl.deleteMany({});
    deleted += r.deletedCount;
    print(`  ✅ Monthly Trainings eliminados: ${r.deletedCount}`);
  }

  // 4. Training Dates
  if (trainingDates.length > 0) {
    const r = trainingDatesColl.deleteMany({});
    deleted += r.deletedCount;
    print(`  ✅ Training Dates eliminados: ${r.deletedCount}`);
  }

  // 5. Training Schedules
  if (schedules.length > 0) {
    const r = trainingSchedulesColl.deleteMany({});
    deleted += r.deletedCount;
    print(`  ✅ Training Schedules eliminados: ${r.deletedCount}`);
  }

  // 6. Trainings (config)
  if (trainings.length > 0) {
    const r = trainingsColl.deleteMany({});
    deleted += r.deletedCount;
    print(`  ✅ Trainings eliminados: ${r.deletedCount}`);
  }

  // 7. Limpiar array entrenamientos en usuarios (opcional)
  if (LIMPIAR_ENTRENAMIENTOS_EN_USUARIOS) {
    const r = usersColl.updateMany(
      { entrenamientos: { $exists: true, $ne: [] } },
      { $set: { entrenamientos: [] } }
    );
    if (r.modifiedCount > 0) {
      print(`  ✅ Usuarios actualizados (entrenamientos vaciados): ${r.modifiedCount}`);
    }
  }

  print(`\n  Total eliminado: ${deleted} documentos`);
  print("\n✅ Limpieza completada. Podés empezar con las pruebas reales.");
} else if (DRY_RUN) {
  print("\n⚠️ MODO DRY RUN: No se eliminó nada.");
  print("Para eliminar, editá el script y cambiá DRY_RUN a false.");
} else {
  print("\n✅ No había documentos para eliminar.");
}

print("\n=== FIN DEL SCRIPT ===");
