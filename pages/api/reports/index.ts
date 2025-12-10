import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Report from '../../../models/Report';
import User from '../../../models/User';
import { getCloudinaryImageUrl } from '../../../lib/cloudinary';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    await dbConnect();

    // Verificar si el usuario es administrador
    const user = await User.findOne({ email: session.user.email }).select('role');
    const isAdmin = user?.role === 'admin';

    // Obtener parámetros de consulta
    const { 
      limit = '10', 
      featured = 'false', 
      type,
      category,
      page = '1'
    } = req.query;

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    // Los administradores ven TODOS los informes, usuarios normales solo los publicados
    const filters: any = {};
    
    if (!isAdmin) {
      filters.isPublished = true;
    }
    
    if (featured === 'true') {
      filters.isFeature = true;
    }
    
    if (type && type !== 'all') {
      filters.type = type;
    }

    if (category && category !== 'all') {
      filters.category = category;
    }

    console.log('📊 Obteniendo informes con filtros:', filters, '| Admin:', isAdmin);

    // Obtener informes con paginación
    const reports = await Report.find(filters)
      .populate('author', 'name email image')
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Contar total de informes para paginación
    const totalReports = await Report.countDocuments(filters);

    // Procesar informes para incluir URLs optimizadas de Cloudinary
    const processedReports = reports.map((report: any) => {
      // Generar URL optimizada para imagen de portada
      let optimizedImageUrl = null;
      if (report.coverImage?.public_id) {
        optimizedImageUrl = getCloudinaryImageUrl(report.coverImage.public_id, {
          width: 600,
          height: 400,
          crop: 'limit',
          format: 'webp',
          quality: 'auto'
        });
      }

      // Generar URLs optimizadas para imágenes adicionales
      let optimizedImages: any[] = [];
      if (report.images && report.images.length > 0) {
        optimizedImages = report.images.map((img: any) => ({
          ...img,
          optimizedUrl: getCloudinaryImageUrl(img.public_id, {
            width: 800,
            height: 800,
            crop: 'limit',
            format: 'webp',
            quality: 'auto'
          }),
          originalUrl: img.secure_url || img.url
        }));
      }

      return {
        ...report,
        // URL de portada optimizada para listado
        imageUrl: optimizedImageUrl,
        // Imágenes adicionales optimizadas
        optimizedImages,
        // Generar resumen si no existe
        summary: report.summary || (report.content ? 
          report.content.substring(0, 150) + '...' : 
          'Sin descripción disponible'),
        // Usar el tiempo de lectura almacenado en la base de datos
        readTime: report.readTime || 1
      };
    });

    console.log('✅ Informes obtenidos:', processedReports.length);

    return res.status(200).json({
      success: true,
      data: {
        reports: processedReports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalReports,
          totalPages: Math.ceil(totalReports / limitNum),
          hasMore: pageNum * limitNum < totalReports
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo informes:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 