// dist 결과물을 파일 하나로 합친다. 어디든 올려서 링크 하나로 열기 위한 것.
// 사용: SINGLE=1 npm run build && node scripts/build-page.mjs [출력경로]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'dist/훈련기록.html'
const assets = readdirSync('dist/assets')
const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))

const head = readFileSync('index.html', 'utf8')
const fonts = head.match(/<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis[^>]*>/)?.[0] ?? ''

writeFileSync(
  out,
  [
    '<title>훈련기록</title>',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    fonts,
    `<style>\n${readFileSync(join('dist/assets', css), 'utf8')}\n</style>`,
    '<div id="root"></div>',
    `<script type="module">\n${readFileSync(join('dist/assets', js), 'utf8')}\n</script>`,
  ].join('\n'),
)
console.log(`${out} 생성`)
