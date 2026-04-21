const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const mime = require('mime'); // Acá agregué mime. Actualización: lo borré porque me crasheaba el servidor. 
// Actualización 2: metí la versión 3 que anda joya con require.

// Acá hice este objeto para la caché porque es obligatorio por la Unidad 2
const cache = {};

const server = http.createServer(async (req, res) => {
    const { method, url } = req;
    const parsedUrl = new URL(url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    console.log(`\n--- Me pidieron un ${method} en ${pathname} ---`);

    // --- SECCIÓN GET: Acá manejo todo lo que es pedir páginas o archivos ---
    if (method === 'GET') {
        
        // --- DINÁMICO: Armo la lista de noticias leyendo el TXT ---
        if (pathname === '/') {
            try {
                const contenidoTxt = await fs.readFile(path.join(__dirname, 'public', 'noticias.txt'), 'utf-8');
                const noticias = contenidoTxt.split('--------------------------\n').filter(n => n.trim() !== '');
                
                let listadoHtml = noticias.map((n, index) => {
                    const lineas = n.split('\n');
                    const titulo = lineas[0].replace('TÍTULO: ', '');
                    return `
                        <div class="card bg-dark text-light mb-3 border-secondary">
                            <div class="card-body">
                                <h5 class="card-title text-info">${titulo}</h5>
                                <a href="/noticia?id=${index + 1}" class="btn btn-sm btn-outline-info">Leer detalle (ID: ${index + 1})</a>
                            </div>
                        </div>`;
                }).join('');

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <!DOCTYPE html>
                    <html lang="es">
                    <head>
                        <meta charset="UTF-8">
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                        <title>Portal de Noticias</title>
                    </head>
                    <body class="bg-dark text-light p-5">
                        <div class="container bg-secondary p-5 rounded-4 shadow-lg" style="max-width: 800px;">
                            <h1 class="text-center fw-bold mb-4">Portal de Noticias</h1>
                            <div class="mb-4 text-center">
                                <a href="/formulario.html" class="btn btn-primary rounded-pill px-4">Publicar Nueva Noticia</a>
                            </div>
                            <hr class="border-secondary mb-4">
                            ${listadoHtml || '<p class="text-center">Todavía no cargué ninguna noticia.</p>'}
                        </div>
                    </body>
                    </html>
                `);
                return;
            } catch (error) {
                // Si el archivo no existe, no me hago drama y sigo
            }
        }

        // --- DETALLE: Acá busco una sola noticia por el ID que me pasen ---
        if (pathname === '/noticia') {
            const id = parsedUrl.searchParams.get('id'); 
            try {
                const contenidoTxt = await fs.readFile(path.join(__dirname, 'public', 'noticias.txt'), 'utf-8');
                const noticias = contenidoTxt.split('--------------------------\n').filter(n => n.trim() !== '');
                const noticiaSeleccionada = noticias[parseInt(id) - 1];

                if (noticiaSeleccionada) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <!DOCTYPE html>
                        <html lang="es">
                        <head>
                            <meta charset="UTF-8">
                            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                        </head>
                        <body class="bg-dark text-light p-5 d-flex align-items-center justify-content-center vh-100">
                            <div class="container bg-secondary p-5 rounded-4 shadow-lg" style="max-width: 600px;">
                                <h2 class="text-info fw-bold mb-3">Noticia #${id}</h2>
                                <pre class="bg-dark text-light p-4 rounded" style="white-space: pre-wrap;">${noticiaSeleccionada}</pre>
                                <a href="/" class="btn btn-primary mt-3 rounded-pill px-4">Volver</a>
                            </div>
                        </body>
                        </html>
                    `);
                } else {
                    throw new Error('No la encontré');
                }
                return;
            } catch (error) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 - Esa noticia no existe.');
                return;
            }
        }

        // --- ESTÁTICOS: Acá sirvo el CSS y el HTML usando la caché que pidió el profe ---
        let archivoSolicitado = pathname === '/' ? 'index.html' : pathname.slice(1);
        let absolutePath = path.join(__dirname, 'public', archivoSolicitado);
        
        try {
            let data;
            if (cache[absolutePath]) {
                console.log('⚡ Esto salió de la caché (memoria)');
                data = cache[absolutePath];
            } else {
                console.log('💾 Tuve que ir al disco a buscar el archivo');
                data = await fs.readFile(absolutePath);
                cache[absolutePath] = data; // Me lo guardo en la memoria para la próxima
            }

            // Acá uso la librería mime que al final me funcionó
            const mimeType = mime.getType(absolutePath) || 'text/plain'; 
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 - No encontré el archivo.`);
        }
    } 
    
    // --- SECCIÓN POST: Acá recibo lo que escriben en el formulario ---
    else if (method === 'POST' && pathname === '/nueva-noticia') {
        let body = '';
        // Voy agarrando los pedacitos de datos que vienen (chunks)
        req.on('data', chunk => { body += chunk.toString(); }); 

        req.on('end', async () => {
            const datos = new URLSearchParams(body);
            const titulo = datos.get('titulo');
            const contenido = datos.get('contenido');
            const registro = `TÍTULO: ${titulo}\nCONTENIDO: ${contenido}\n--------------------------\n`;

            try {
                const rutaTxt = path.join(__dirname, 'public', 'noticias.txt');
                // Lo guardo en el TXT sin borrar lo que ya estaba
                await fs.appendFile(rutaTxt, registro); 
                
                // Le mando la pantalla de éxito 
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <!DOCTYPE html>
                    <html lang="es">
                    <head>
                        <meta charset="UTF-8">
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    </head>
                    <body class="bg-dark text-light d-flex align-items-center justify-content-center vh-100">
                        <div class="container text-center p-5 bg-secondary rounded-4 shadow-lg" style="max-width: 500px;">
                            <h2 class="text-info fw-bold mb-3">¡Noticia Guardada!</h2>
                            <p class="lead mb-4">Ya se puede ver en el inicio.</p>
                            <div class="d-grid gap-3">
                                <a href="/" class="btn btn-primary btn-lg rounded-pill">Ir al Inicio</a>
                                <a href="/formulario.html" class="btn btn-outline-light rounded-pill">Cargar otra</a>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('500 - Se rompió algo guardando.');
            }
        });
    }
});
//cree la const port porque vi que lo hacian en videos en vez de meterla en server listen 
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Mi servidor está andando en el puerto ${PORT}`);
});