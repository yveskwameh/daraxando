/**
 * Name ideas. Each one fuses a legend, a place or a famous moment with what it is known for,
 * so names feel Nigerian without belonging to anyone living.
 */
export const NAME_POOL = [
  'Durbar Queen', 'Zaria Warrior', 'Zazzau Rider', 'Ife Heroine', 'Edi Brave', 'Ife Bronze', 'Bronze Iyoba',
  'Opobo King', 'Palm Oil Baron', 'Creek King', 'Oba Market Mama', 'Benin Trader', 'FESTAC 77',
  'Atlanta 96 Gold', 'Eagles 94', 'Eko Owambe', 'Kano Durbar', 'Up NEPA', 'Calabar Carnival',
  'Argungu Fisher', 'Plateau Chill', 'Abeokuta Rock', 'Aba Made', 'Coal City Queen', 'Garden City Ace',
  'Ogbunike Caver', 'Obudu Climber', 'Yankari Ranger', 'Osun Grove', 'Idanre Hills', 'Ikogosi Springs',
  'Zuma Rock', 'Lekki Sunrise', 'Onitsha Market', 'Ariaria Boss', 'Suya Spot Chief',
];

export function suggestNames(count = 5, avoid?: string) {
  const pool = NAME_POOL.filter((n) => n !== avoid);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
