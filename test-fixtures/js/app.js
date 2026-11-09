import { formatear } from './utilidades.js';
// const comentada = 1;
const MAXIMO = 10, MINIMO = 0;
let { nombre, edad: anios, ...resto } = { nombre: 'Lía', edad: 3 };
var antiguo = "let x = 1; function falsa() {}";
const texto = `Hola ${nombre}, tienes ${anios > 1 ? 'años' : 'año'} y const y = 2`;
const patron = /function\s+\w+/g;
const mitad = MAXIMO / 2 / 1;

function saludar(persona) {
  console.log(`Hola, ${persona}`);
}

const doble = (n) => n * 2;
const triple = function (n) { return n * 3; };

class Gato {
  constructor(nombre) { this.nombre = nombre; }
  maullar() { return 'miau'; }
  static crear() { return new Gato('Mia'); }
}

for (let i = 0; i < 3; i++) { console.info(i); }
for (const gato of [new Gato('Mia')]) saludar(gato.nombre);

document.querySelector('button').addEventListener('click', () => {
  saludar(formatear(nombre));
});
