// Bekende fouten uit de openingspraktijk. `moves` = partij tot en met de fout (laatste zet = de fout).
export const POSITIONS: { name: string; moves: string[]; question: string }[] = [
  { name: "Scholar's mate niet verdedigd", moves: ["e4","e5","Bc4","Nc6","Qh5","Nf6"], question: "Waarom is Nf6 zo slecht?" },
  { name: "Fool's mate", moves: ["f3","e5","g4"], question: "Wat ging er mis met g4?" },
  { name: "Legal's mate-val", moves: ["e4","e5","Nf3","d6","Bc4","Bg4","Nc3","g6"], question: "Waarom is g6 een fout?" },
  { name: "Blackburne Shilling-val", moves: ["e4","e5","Nf3","Nc6","Bc4","Nd4","Nxe5"], question: "Ik won toch een pion met Nxe5?" },
  { name: "Lasker-val", moves: ["d4","d5","c4","e5","dxe5","d4","e3","Bb4+","Bd2","dxe3","Bxb4"], question: "Waarom is Bxb4 hier fout?" },
  { name: "Englund-val", moves: ["d4","e5","dxe5","Nc6","Nf3","Qe7","Bf4","Qb4+","Bd2","Qxb2","Bc3"], question: "Wat had ik moeten spelen in plaats van Bc3?" },
  { name: "Damiano-verdediging", moves: ["e4","e5","Nf3","f6"], question: "Is f6 een goede manier om e5 te verdedigen?" },
  { name: "Noah's Ark-val", moves: ["e4","e5","Nf3","Nc6","Bb5","a6","Ba4","d6","d4","b5","Bb3","Nxd4","Nxd4","exd4","Qxd4"], question: "Waarom is Qxd4 fout?" },
  { name: "Fried Liver-toegang", moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5"], question: "Waarom is Nxd5 riskant?" },
  { name: "Wat-als-vraag", moves: ["e4","e5","Nf3","Nc6","Bc4","Nd4","Nxe5"], question: "Wat als ik O-O had gespeeld in plaats van Nxe5?" },
];
