"use strict";

var vs = `#version 300 es

in vec4 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;

var fs = `#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec4 v_color;

uniform vec4 u_colorMult;

out vec4 outColor;

void main() {
   outColor = v_color * u_colorMult;
}
`;

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Tell the twgl to match position with a_position, n
  // normal with a_normal etc..
  twgl.setAttributePrefix("a_");

  var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 12, 6);
  var cubeBufferInfo   = flattenedPrimitives.createCubeBufferInfo(gl, 20);
  var coneBufferInfo   = flattenedPrimitives.createTruncatedConeBufferInfo(gl, 10, 0, 20, 12, 1, true, false);

  // setup GLSL program
  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);
  var cubeVAO   = twgl.createVAOFromBufferInfo(gl, programInfo, cubeBufferInfo);
  var coneVAO   = twgl.createVAOFromBufferInfo(gl, programInfo, coneBufferInfo);

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  function rand(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  function emod(x, n) {
    return x >= 0 ? (x % n) : ((n - (-x % n)) % n);
  }

  var fieldOfViewRadians = degToRad(60);

  // put the shapes in an array so it's easy to pick them at random
  var shapes = [
    { bufferInfo: sphereBufferInfo, vertexArray: sphereVAO, },
    { bufferInfo: cubeBufferInfo,   vertexArray: cubeVAO, },
    { bufferInfo: coneBufferInfo,   vertexArray: coneVAO, },
  ];

  var objectsToDraw = [];
  var objects = [];

  // Make infos for each object for each object.
  var baseHue = rand(360);
  var numObjects = 200;
  for (var ii = 0; ii < numObjects; ++ii) {
    // pick a shape
    var shape = shapes[rand(shapes.length) | 0];

    // make an object.
    var object = {
      uniforms: {
        u_colorMult: chroma.hsv(emod(baseHue + rand(120), 360), rand(0.5, 1), rand(0.5, 1)).gl(),
        u_matrix: m4.identity(),
      },
      translation: [rand(-100, 100), rand(-100, 100), rand(-150, -50)],
      xRotationSpeed: rand(0.8, 1.2),
      yRotationSpeed: rand(0.8, 1.2),
    };
    objects.push(object);

    // Add it to the list of things to draw.
    objectsToDraw.push({
      programInfo: programInfo,
      bufferInfo: shape.bufferInfo,
      vertexArray: shape.vertexArray,
      uniforms: object.uniforms,
    });
  }

  function computeMatrix(viewProjectionMatrix, translation, xRotation, yRotation) {
    var matrix = m4.translate(viewProjectionMatrix,
        translation[0],
        translation[1],
        translation[2]);
    matrix = m4.xRotate(matrix, xRotation);
    return m4.yRotate(matrix, yRotation);
  }

  requestAnimationFrame(drawScene);

  // Draw the scene.
  function drawScene(time) {
    time = time * 0.0005;

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Compute the projection matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // Compute the camera's matrix using look at.
    var cameraPosition = [0, 0, 100];
    var target = [0, 0, 0];
    var up = [0, 1, 0];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // Compute the matrices for each object.
    objects.forEach(function(object) {
      object.uniforms.u_matrix = computeMatrix(
          viewProjectionMatrix,
          object.translation,
          object.xRotationSpeed * time,
          object.yRotationSpeed * time);
    });

    // ------ Draw the objects --------

    var lastUsedProgramInfo = null;
    var lastUsedVertexArray = null;

    objectsToDraw.forEach(function(object) {
      var programInfo = object.programInfo;
      var vertexArray = object.vertexArray;

      if (programInfo !== lastUsedProgramInfo) {
        lastUsedProgramInfo = programInfo;
        gl.useProgram(programInfo.program);
      }

      // Setup all the needed attributes.
      if (lastUsedVertexArray !== vertexArray) {
        lastUsedVertexArray = vertexArray;
        gl.bindVertexArray(vertexArray);
      }

      // Set the uniforms.
      twgl.setUniforms(programInfo, object.uniforms);

      // Draw
      twgl.drawBufferInfo(gl, object.bufferInfo);
    });

    requestAnimationFrame(drawScene);
  }
}

main();