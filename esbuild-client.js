let esbuild = require('esbuild');

let main = async () => {
    let result = esbuild.buildSync({
        entryPoints: ['./src/lib/transport-http-client.ts'],
        bundle: true,
        minify: false,
        sourcemap: true,
        metafile: true,
        platform: 'browser',
        target: [ 'firefox90', 'chrome90', 'safari13', 'edge90' ],
        outdir: './build',
    });

    console.log('esbuild: client');
    console.log(await esbuild.analyzeMetafile(result.metafile));
}
main();
