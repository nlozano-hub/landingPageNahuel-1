import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Report from '../../../models/Report';
import User from '../../../models/User';
import { getCloudinaryImageUrl } from '../../../lib/cloudinary';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    await dbConnect();

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID del informe requerido' });
    }

    // Verificar que el usuario sea administrador para operaciones PUT
    if (req.method === 'PUT') {
      const user = await User.findOne({ email: session.user.email }).select('role');
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo administradores pueden editar informes' });
      }
    }

    console.log('📖 Obteniendo informe:', id);

    // Buscar el informe por ID
    const report = await Report.findById(id)
      .populate('author', 'name email image')
      .lean() as any;

    if (!report) {
      return res.status(404).json({ message: 'Informe no encontrado' });
    }

    // Manejar actualización de informe (PUT)
    if (req.method === 'PUT') {
      const { title, content, isPublished, images } = req.body;

      // Validar datos requeridos
      if (!title || !content) {
        return res.status(400).json({ message: 'Título y contenido son requeridos' });
      }

      // Procesar imágenes para asegurar que tengan el campo 'order' correcto
      let processedImages: any[] = [];
      if (images && Array.isArray(images)) {
        processedImages = images.map((img: any, index: number) => ({
          public_id: img.public_id,
          url: img.url || img.secure_url,
          secure_url: img.secure_url || img.url,
          width: img.width,
          height: img.height,
          format: img.format,
          bytes: img.bytes,
          caption: img.caption || '',
          order: img.order || (index + 1) // Usar el order proporcionado o asignar basado en posición
        }));

        console.log('📸 Imágenes procesadas con orden:', processedImages.map(img => ({ public_id: img.public_id, order: img.order })));
      }

      // Actualizar el informe
      const updatedReport = await Report.findByIdAndUpdate(
        id,
        {
          title: title.trim(),
          content: content.trim(),
          isPublished: isPublished !== undefined ? isPublished : true,
          images: processedImages,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).populate('author', 'name email image');

      if (!updatedReport) {
        return res.status(404).json({ message: 'Informe no encontrado para actualizar' });
      }

      console.log('✅ Informe actualizado exitosamente:', updatedReport.title);

      return res.status(200).json({
        success: true,
        message: 'Informe actualizado exitosamente',
        data: {
          report: updatedReport
        }
      });
    }

    // Verificar que el informe esté publicado (solo para GET y usuarios no admin)
    const currentUser = await User.findOne({ email: session.user.email }).select('role');
    const isAdmin = currentUser?.role === 'admin';
    
    if (!report.isPublished && !isAdmin) {
      return res.status(403).json({ message: 'Informe no disponible' });
    }

    // Procesar informe para incluir URLs optimizadas de Cloudinary
    let optimizedImageUrl = null;
    if (report.coverImage?.public_id) {
      optimizedImageUrl = getCloudinaryImageUrl(report.coverImage.public_id, {
        width: 1200,
        height: 800,
        crop: 'limit',
        format: 'webp',
        quality: 'auto'
      });
    }

    // Generar URLs optimizadas para imágenes adicionales
    let optimizedImages: any[] = [];
    if (report.images && report.images.length > 0) {
      optimizedImages = report.images
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((img: any) => ({
          ...img,
          // URL optimizada para vista normal (mantiene aspect ratio)
          optimizedUrl: getCloudinaryImageUrl(img.public_id, {
            width: 1200,
            height: 1200,
            crop: 'limit',
            format: 'webp',
            quality: 'auto'
          }),
          // URL original para modal (sin transformaciones)
          originalUrl: img.secure_url || img.url,
          // Thumbnail para galería (mantiene aspect ratio)
          thumbnailUrl: getCloudinaryImageUrl(img.public_id, {
            width: 400,
            height: 400,
            crop: 'limit',
            format: 'webp',
            quality: 'auto'
          })
        }));
    }

    const processedReport = {
      ...report,
      // Imágenes adicionales optimizadas
      optimizedImages,
    };

    // Incrementar contador de vistas de forma asíncrona
    Report.findByIdAndUpdate(
      id, 
      { $inc: { views: 1 } }, 
      { new: false }
    ).catch(error => {
      console.error('Error actualizando vistas:', error);
    });

    console.log('✅ Informe obtenido exitosamente:', report.title);

    return res.status(200).json({
      success: true,
      data: {
        report: processedReport
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo informe:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 