// Copyright 2019 Erik De Rijcke
//
// This file is part of Greenfield.
//
// Greenfield is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Greenfield is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with Greenfield.  If not, see <https://www.gnu.org/licenses/>.

'use strict'

const gstreamer = require('gstreamer-superficial')

const WlShmFormat = require('./WlShmFormat')

const EncodedFrame = require('./EncodedFrame')
const EncodedFrameFragment = require('./EncodedFrameFragment')
const EncodingOptions = require('./EncodingOptions')

const { h264 } = require('./EncodingTypes')

const gstFormats = {
  [WlShmFormat.argb8888]: 'BGRA',
  [WlShmFormat.xrgb8888]: 'BGRx'
}

/**
 * @implements FrameEncoder
 */
class H264AlphaEncoder {
  /**
   * @param {number}width
   * @param {number}height
   * @param {number}wlShmFormat
   * @return {H264AlphaEncoder}
   */
  static create (width, height, wlShmFormat) {
    const gstBufferFormat = gstFormats[wlShmFormat]
    const pipeline = new gstreamer.Pipeline(
      // scale & convert to RGBA
      `appsrc name=source caps=video/x-raw,format=${gstBufferFormat},width=${width},height=${height},framerate=60/1 ! 
      videoscale ! capsfilter name=scale caps=video/x-raw,width=${width + (width % 2)},height=${height + (height % 2)} ! 
      
      tee name=t ! queue ! 
      glupload ! 
      glcolorconvert ! 
      glshader fragment="
        #version 120
        #ifdef GL_ES
        precision mediump float;
        #endif
        varying vec2 v_texcoord;
        uniform sampler2D tex;
        uniform float time;
        uniform float width;
        uniform float height;

        void main () {
          vec4 pix = texture2D(tex, v_texcoord);
          gl_FragColor = vec4(pix.a,pix.a,pix.a,0);
        }
      " 
      vertex = "
        #version 120
        #ifdef GL_ES
        precision mediump float;
        #endif
        attribute vec4 a_position;
        attribute vec2 a_texcoord;
        varying vec2 v_texcoord;
        
        void main() {
          gl_Position = a_position;
          v_texcoord = a_texcoord;
      }
      " ! 
      glcolorconvert ! video/x-raw(memory:GLMemory),format=I420 ! 
      gldownload ! 
      x264enc key-int-max=900 byte-stream=true pass=quant qp-max=32 tune=zerolatency speed-preset=veryfast intra-refresh=0 ! 
      video/x-h264,profile=constrained-baseline,stream-format=byte-stream,alignment=au,framerate=60/1 ! 
      appsink name=alphasink 
      
      t. ! queue ! 
      videoconvert ! video/x-raw,format=I420 ! 
      x264enc key-int-max=900 byte-stream=true pass=quant qp-max=32 tune=zerolatency speed-preset=veryfast intra-refresh=0 ! 
      video/x-h264,profile=constrained-baseline,stream-format=byte-stream,alignment=au,framerate=60/1 ! 
      appsink name=sink`
    )

    const alphasink = pipeline.findChild('alphasink')
    const sink = pipeline.findChild('sink')
    const src = pipeline.findChild('source')
    const scale = pipeline.findChild('scale')
    pipeline.play()

    return new H264AlphaEncoder(pipeline, sink, alphasink, src, width, height, wlShmFormat, scale)
  }

  /**
   * @param {Object}pipeline
   * @param {Object}sink
   * @param {Object}alphaSink
   * @param {Object}src
   * @param {number}width
   * @param {number}height
   * @param {number}wlShmFormat
   * @param {Object}scale
   * @private
   */
  constructor (pipeline, sink, alphaSink, src, width, height, wlShmFormat, scale) {
    /**
     * @type {Object}
     * @private
     */
    this._pipeline = pipeline
    /**
     * @type {Object}
     * @private
     */
    this._sink = sink
    /**
     * @type {Object}
     * @private
     */
    this._alphaSink = alphaSink
    /**
     * @type {Object}
     * @private
     */
    this._src = src
    /**
     * @type {number}
     * @private
     */
    this._width = width
    /**
     * @type {number}
     * @private
     */
    this._height = height
    /**
     * @type {number}
     * @private
     */
    this._wlShmFormat = wlShmFormat
    /**
     * @type {Object}
     * @private
     */
    this._scale = scale
  }

  /**
   * @param {number}width
   * @param {number}height
   * @param {string}gstBufferFormat
   * @private
   */
  _configure (width, height, gstBufferFormat) {
    this._src.caps = `video/x-raw,format=${gstBufferFormat},width=${width},height=${height},framerate=60/1`
    this._scale.caps = `video/x-raw,width=${width + (width % 2)},height=${height + (height % 2)}`
  }

  /**
   * @param {Buffer}pixelBuffer
   * @param {number}wlShmFormat
   * @param {number}x
   * @param {number}y
   * @param {number}width
   * @param {number}height
   * @return {Promise<EncodedFrameFragment>}
   * @private
   */
  async _encodeFragment (pixelBuffer, wlShmFormat, x, y, width, height) {
    if (this._width !== width || this._height !== height || this._wlShmFormat !== wlShmFormat) {
      this._width = width
      this._height = height
      this._wlShmFormat = wlShmFormat

      const gstBufferFormat = gstFormats[wlShmFormat]
      this._configure(width, height, gstBufferFormat)
    }

    const encodingPromise = new Promise((resolve) => {
      let opaque = null
      let alpha = null
      this._sink.pull((opaqueH264) => {
        opaque = opaqueH264
        if (opaque && alpha) {
          resolve({ opaque: opaque, alpha: alpha })
        }
      })

      this._alphaSink.pull((alphaH264) => {
        alpha = alphaH264
        if (opaque && alpha) {
          resolve({ opaque: opaque, alpha: alpha })
        }
      })
    })

    this._src.push(pixelBuffer)
    const { opaque, alpha } = await encodingPromise

    return EncodedFrameFragment.create(x, y, width, height, opaque, alpha)
  }

  /**
   * @param {Buffer}pixelBuffer
   * @param {number}wlShmFormat
   * @param {number}bufferWidth
   * @param {number}bufferHeight
   * @param {number}serial
   * @return {Promise<EncodedFrame>}
   * @override
   */
  async encodeBuffer (pixelBuffer, wlShmFormat, bufferWidth, bufferHeight, serial) {
    let encodingOptions = 0
    encodingOptions = EncodingOptions.enableSplitAlpha(encodingOptions)
    encodingOptions = EncodingOptions.enableFullFrame(encodingOptions)
    const encodedFrameFragment = await this._encodeFragment(pixelBuffer, wlShmFormat, 0, 0, bufferWidth, bufferHeight)
    return EncodedFrame.create(serial, h264, encodingOptions, bufferWidth, bufferHeight, [encodedFrameFragment])
  }
}

module.exports = H264AlphaEncoder
