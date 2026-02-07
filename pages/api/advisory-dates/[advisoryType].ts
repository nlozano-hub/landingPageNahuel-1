import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAPI } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import AdvisoryDate from '@/models/AdvisoryDate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();
    
    const { advisoryType } = req.query;

    if (req.method === 'GET') {
      return await handleGet(req, res, advisoryType as string);
    } else if (req.method === 'POST') {
      return await handlePost(req, res, advisoryType as string);
    } else if (req.method === 'PUT') {
      return await handlePut(req, res, advisoryType as string);
    } else if (req.method === 'DELETE') {
      return await handleDelete(req, res, advisoryType as string);
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ 
        success: false, 
        error: `Método ${req.method} no permitido` 
      });
    }
  } catch (error) {
    console.error('Error en /api/advisory-dates:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
}

// GET /api/advisory-dates/[advisoryType] - Obtener fechas de asesoría
async function handleGet(req: NextApiRequest, res: NextApiResponse, advisoryType: string) {
  try {
    const onlyAvailable = req.query.available === 'true';
    const futureOnly = req.query.futureOnly !== 'false';
    const includeInactive = req.query.includeInactive === 'true'; // Para admin: ver todas las fechas
    
    const query: any = { advisoryType };
    
    // Solo filtrar por isActive si no se solicita incluir inactivas (para admin)
    if (!includeInactive) {
      query.isActive = true;
    }
    
    if (onlyAvailable) {
      const now = new Date();
      // Excluir fechas que están reservadas O que tienen reservas temporales activas
      query.$and = [
        { isBooked: false },
        {
          $or: [
            { tempReservationExpiresAt: { $exists: false } },
            { tempReservationExpiresAt: { $lte: now } }
          ]
        }
      ];
    }

    // Limpiar reservas temporales expiradas antes de obtener las fechas
    const now = new Date();
    const cleanupResult = await AdvisoryDate.updateMany(
      {
        advisoryType,
        isActive: true,
        isBooked: true,
        confirmedBooking: false,
        tempReservationExpiresAt: { $lte: now }
      },
      {
        $set: {
          isBooked: false,
          tempReservationTimestamp: undefined,
          tempReservationExpiresAt: undefined
        }
      }
    );

    if (cleanupResult.modifiedCount > 0) {
      console.log(`🧹 Limpieza automática: ${cleanupResult.modifiedCount} reservas temporales liberadas`);
    }

    let advisoryDates = await AdvisoryDate.find(query).sort({ date: 1 });

    // Excluir slots que ya hayan pasado (fecha anterior o misma fecha con hora menor)
    if (futureOnly) {

      advisoryDates = advisoryDates.filter((slot: any) => {
        const slotDate = new Date(slot.date);
        const [h, m] = (slot.time || '00:00').split(':').map((n: string) => parseInt(n, 10));
        // Construir instante en UTC a partir del día guardado (mediodía UTC) + hora local de Montevideo
        // Uruguay es UTC-3, por lo que sumamos 3 horas para llevarlo a UTC
        const slotUtc = new Date(Date.UTC(
          slotDate.getUTCFullYear(),
          slotDate.getUTCMonth(),
          slotDate.getUTCDate(),
          h + 3,
          m,
          0,
          0
        ));
        return slotUtc.getTime() > now.getTime();
      });
    }

    return res.status(200).json({
      success: true,
      dates: advisoryDates
    });
  } catch (error) {
    console.error('Error obteniendo fechas de asesoría:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener fechas de asesoría'
    });
  }
}

// POST /api/advisory-dates/[advisoryType] - Crear nueva fecha de asesoría (solo admin)
async function handlePost(req: NextApiRequest, res: NextApiResponse, advisoryType: string) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    // Verificar rol admin centrado
    const adminCheck = await verifyAdminAPI(req, res);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ success: false, error: adminCheck.error || 'Permisos insuficientes' });
    }

    const { date, time, title, description } = req.body;

    if (!date || !time || !title) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: date, time, title'
      });
    }

    // Crear la fecha en UTC para evitar problemas de zona horaria
    // La fecha viene como "YYYY-MM-DD" desde el frontend
    const [year, month, day] = date.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)); // Guardar al mediodía UTC para evitar saltos de día

    const newAdvisoryDate = new AdvisoryDate({
      advisoryType,
      date: utcDate,
      time,
      title,
      description,
      isActive: true,
      isBooked: false,
      createdBy: session.user.email,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newAdvisoryDate.save();

    return res.status(201).json({
      success: true,
      data: newAdvisoryDate,
      message: 'Fecha de asesoría creada exitosamente'
    });
  } catch (error) {
    console.error('Error creando fecha de asesoría:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al crear fecha de asesoría'
    });
  }
}

// PUT /api/advisory-dates/[advisoryType] - Actualizar fecha de asesoría (solo admin)
async function handlePut(req: NextApiRequest, res: NextApiResponse, advisoryType: string) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    const adminCheck = await verifyAdminAPI(req, res);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ success: false, error: adminCheck.error || 'Permisos insuficientes' });
    }

    const { id, date, time, title, description } = req.body;

    if (!id || !date || !time || !title) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: id, date, time, title'
      });
    }

    // Crear la fecha en UTC para evitar problemas de zona horaria
    // La fecha viene como "YYYY-MM-DD" desde el frontend
    const [year, month, day] = date.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)); // Guardar al mediodía UTC para evitar saltos de día

    const updatedAdvisoryDate = await AdvisoryDate.findByIdAndUpdate(
      id,
      {
        date: utcDate,
        time,
        title,
        description,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedAdvisoryDate) {
      return res.status(404).json({
        success: false,
        error: 'Fecha de asesoría no encontrada'
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedAdvisoryDate,
      message: 'Fecha de asesoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando fecha de asesoría:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al actualizar fecha de asesoría'
    });
  }
}

// DELETE /api/advisory-dates/[advisoryType] - Eliminar fecha de asesoría (solo admin)
async function handleDelete(req: NextApiRequest, res: NextApiResponse, advisoryType: string) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    const adminCheck = await verifyAdminAPI(req, res);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ success: false, error: adminCheck.error || 'Permisos insuficientes' });
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID de fecha requerido'
      });
    }

    await AdvisoryDate.findByIdAndUpdate(id, {
      isActive: false,
      updatedAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Fecha de asesoría eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando fecha de asesoría:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al eliminar fecha de asesoría'
    });
  }
}
