# puente-kit

Servicio de [KitDani](https://github.com/Dasge97/KitDani) que mantiene siempre en marcha el Puente local de [Browser Eye](https://github.com/Dasge97/claude-browser-eye-extension) y enseña su estado en el panel.

Browser Eye funciona sin esto: su adaptador MCP arranca el Puente cuando hace falta. Este servicio sirve para tenerlo encendido desde que arranca Windows y verlo en el Kit.

## Qué hace

- Lanza `bridge.mjs start` sin ventana y lo relanza si se cae.
- Si ya hay un Puente en el puerto (por ejemplo, uno que arrancó un cliente MCP), no lo toca y solo lo vigila.
- Cada 30 segundos consulta `bridge.mjs status --json` y escribe `estado.json` para el Kit: puerto, si la extensión está emparejada y conectada, clientes MCP y tareas activas.
- Acción «Código de emparejamiento» en el Kit: abre una terminal con el código para el panel de la extensión.

## Requisitos

- Node.js 24 en el PATH.
- `claude-browser-eye-extension` clonado y compilado (`pnpm install` y `pnpm build`) en la misma carpeta que este repositorio:

  ```
  <tu carpeta de proyectos>/
    claude-browser-eye-extension/
    puente-kit/
  ```

  Si está en otro sitio, escribe la ruta a su `bridge.mjs` en `ruta-puente.txt` (relativa a esta carpeta o absoluta), o define `BROWSER_EYE_BRIDGE`.

## Instalar en el Kit

Importa esta carpeta desde el panel de KitDani, o:

```powershell
Invoke-RestMethod -Method Post http://localhost:8790/api/importar -ContentType 'application/json' `
  -Body '{ "fuente": "C:/ruta/a/puente-kit", "instalar": true }'
```

Con «instalar», arranca con Windows mediante un acceso directo en la carpeta de Inicio.

## Uso manual

```bash
node puente-kit.mjs          # arranca y vigila el Puente
node puente-kit.mjs pair     # código de emparejamiento
node puente-kit.mjs status   # estado
```

El registro del servicio está en `puente-kit.log`. El del Puente, en `%APPDATA%\BrowserEye\bridge.log`.
