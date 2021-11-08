let esbuild = require('esbuild');

let main = async () => {
    let result = esbuild.buildSync({
        entryPoints: ['./src/lib/transport-http-server.ts'],
        bundle: true,
        minify: false,
        sourcemap: true,
        //metafile: true,
        platform: 'node',
        external: [''],
        target: [ 'node12' ],
        outdir: './build',
    });

    console.log('esbuild: server');
    //console.log(await esbuild.analyzeMetafile(result.metafile));
}
main();
