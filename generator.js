const REGIONS = 2000
const SLICES_PER_REGION = 500;
const HEIGHT = 1000;
const WIDTH = 10000;
const fs = require('fs');

for(let r = 0; r < REGIONS; r++){
    const regionPoints = new Array();
    for(let s = 0; s < SLICES_PER_REGION; s++){
        const y = Math.ceil(Math.random() * (HEIGHT + 1));
        const x = Math.ceil(Math.random() * (WIDTH + 1));
        regionPoints.push([x, y])
    }
    const structure = JSON.stringify({
        region: r,
        points: regionPoints
    })
    fs.writeFile('.\\generated\\region-' + r + '.json', structure, (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
}