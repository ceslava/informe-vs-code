# Publicar en el Marketplace de VS Code

Hay dos caminos. El primero no necesita tokens ni GitHub Actions.

## A. Subir el `.vsix` a mano (lo más sencillo)

1. Entra en <https://marketplace.visualstudio.com/manage> con una cuenta de Microsoft.
2. **Create publisher**: el ID debe ser exactamente el `publisher` de `package.json` (`ceslava`). Si ese ID ya
   está cogido, elige otro y cámbialo en `package.json` (y en `src/integration/index.ts`, que usa `ceslava.informe-web`).
3. Genera el paquete: `npm ci && npm run package` → `informe-web-0.1.0.vsix`.
4. En la página del publisher: **New extension → Visual Studio Code** y sube el `.vsix`. La revisión tarda unos
   minutos; después sale en <https://marketplace.visualstudio.com/items?itemName=ceslava.informe-web>.
5. Para una versión nueva: sube `version` en `package.json`, añade una entrada en `CHANGELOG.md`, vuelve a
   empaquetar y, en la página del publisher, `…` → **Update** con el `.vsix` nuevo.

## B. Publicar desde GitHub al crear una etiqueta

1. Crea el publisher (paso A.2).
2. Crea un token personal en Azure DevOps (<https://dev.azure.com> → User settings → Personal access tokens):
   organización **All accessible organizations**, permiso **Marketplace → Manage**.
3. En el repositorio de GitHub: Settings → Secrets and variables → Actions → **New repository secret**
   `VSCE_PAT` con ese token. Para Open VSX (VSCodium, Cursor…), el secreto `OVSX_PAT` con un token de
   <https://open-vsx.org> (opcional).
4. Sube la versión en `package.json`, anótala en `CHANGELOG.md`, haz commit y crea la etiqueta:

   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```

   El flujo `publicar.yml` pasa las pruebas, publica y crea una versión en GitHub con el `.vsix`.

## Qué mira el Marketplace

| Fichero | Para qué |
|---|---|
| `package.json` | nombre, descripción (traducida con `package.nls*.json`), `icon`, `galleryBanner`, categorías, palabras clave, enlaces al repositorio y a las incidencias |
| `README.md` | la página de la extensión; las imágenes relativas se enlazan al repositorio, así que **el repositorio tiene que ser público** |
| `CHANGELOG.md` | pestaña «Changelog» |
| `LICENSE` | licencia (MIT) |
| `images/icon.png` | icono de 256 × 256 (PNG; el Marketplace no admite SVG) |

Antes de publicar, `npx vsce ls` enseña qué ficheros van dentro del paquete.
