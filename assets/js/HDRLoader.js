(function(global) {
  'use strict';

  const THREE = global.THREE;

  class HDRLoader extends THREE.Loader {
    constructor(manager) {
      super(manager);
      this.type = THREE.HalfFloatType;
    }

    setDataType(value) {
      this.type = value;
      return this;
    }

    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const loader = new THREE.FileLoader(this.manager);
      loader.setPath(this.path);
      loader.setResponseType('arraybuffer');
      loader.setRequestHeader(this.requestHeader);
      loader.setWithCredentials(this.withCredentials);

      loader.load(url, function(arraybuffer) {
        try {
          const texData = scope.parse(arraybuffer);
          onLoad(texData);
        } catch (e) {
          if (onError) onError(e);
          else console.error(e);
          scope.manager.itemError(url);
        }
      }, onProgress, onError);
    }

    parse(arrayBuffer) {
      const byteArray = new Uint8Array(arrayBuffer);
      if (byteArray[0] !== 0x23 || byteArray[1] !== 0x3f) {
        throw new Error('THREE.HDRLoader: Bad magic number.');
      }

      const header = {};
      let pos = 10;
      const view = new DataView(arrayBuffer);
      let line = '';
      while (pos < byteArray.length) {
        const byte = byteArray[pos++];
        const char = String.fromCharCode(byte);

        if (byte === 10) {
          const match = line.match(/^-Y (\d+) \+X (\d+)/);
          if (match) {
            header.height = parseInt(match[1]);
            header.width = parseInt(match[2]);
            break;
          }
          line = '';
        } else if (byte !== 13) {
          line += char;
        }
      }

      if (!header.width || !header.height) {
        throw new Error('THREE.HDRLoader: Unable to parse resolution.');
      }
      const numPixels = header.width * header.height;
      const pixelData = new Uint8Array(numPixels * 4);
      let ptr = 0;
      for (let scanline = 0; scanline < header.height; scanline++) {
        if (byteArray[pos] === 2 && byteArray[pos + 1] === 2) {
          const scanlineWidth = (byteArray[pos + 2] << 8) | byteArray[pos + 3];
          pos += 4;

          if (scanlineWidth !== header.width) {
            throw new Error('THREE.HDRLoader: Invalid scanline width.');
          }
          for (let channel = 0; channel < 4; channel++) {
            let x = 0;
            while (x < header.width) {
              const code = byteArray[pos++];

              if (code > 128) {
                const value = byteArray[pos++];
                const count = code - 128;
                for (let i = 0; i < count; i++) {
                  pixelData[ptr + x * 4 + channel] = value;
                  x++;
                }
              } else {
                for (let i = 0; i < code; i++) {
                  pixelData[ptr + x * 4 + channel] = byteArray[pos++];
                  x++;
                }
              }
            }
          }

          ptr += header.width * 4;
        } else {
          throw new Error('THREE.HDRLoader: Unrecognized scanline format.');
        }
      }

      return {
        width: header.width,
        height: header.height,
        data: pixelData,
        type: this.type,
        colorSpace: THREE.LinearSRGBColorSpace,
      };
    }
  }

  global.HDRLoader = HDRLoader;

})(window);

