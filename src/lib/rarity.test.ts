import { describe, it, expect } from 'vitest';
import { computeRarity, isLegendary, isEpic, isRare } from './rarity';

describe('computeRarity', () => {
  describe('légendaire', () => {
    it('détecte les gris purs', () => {
      expect(computeRarity('#000000')).toBe('legendaire');
      expect(computeRarity('#FFFFFF')).toBe('legendaire');
      expect(computeRarity('#777777')).toBe('legendaire');
    });

    it('détecte les valeurs remarquables 00/80/FF', () => {
      expect(computeRarity('#FF0000')).toBe('legendaire');
      expect(computeRarity('#FF8000')).toBe('legendaire');
      expect(computeRarity('#0080FF')).toBe('legendaire');
    });

    it('détecte les palindromes hex', () => {
      expect(computeRarity('#ABCCBA')).toBe('legendaire');
      expect(isLegendary('#12A21A')).toBe(false); // pas un palindrome
      expect(isLegendary('#1A44A1')).toBe(true);
    });

    it('détecte les suites', () => {
      expect(computeRarity('#123456')).toBe('legendaire');
      expect(computeRarity('#FEDCBA')).toBe('legendaire');
      expect(isLegendary('#123457')).toBe(false);
    });

    it('détecte les octets doublés', () => {
      expect(computeRarity('#AABBCC')).toBe('legendaire');
      expect(computeRarity('#1122EE')).toBe('legendaire');
    });

    it('ne classe pas une couleur quelconque en légendaire', () => {
      expect(isLegendary('#3F6E2B')).toBe(false);
      expect(isLegendary('#A45C31')).toBe(false);
    });
  });

  describe('épique', () => {
    it('détecte les couleurs pures (canal dominant net)', () => {
      expect(isEpic('#F51D0A')).toBe(true); // rouge franc
      expect(isEpic('#0AF5E3')).toBe(true); // cyan franc
      expect(computeRarity('#F51D0A')).toBe('epique');
    });

    it('rejette les couleurs ternes', () => {
      expect(isEpic('#6B705C')).toBe(false);
      expect(isEpic('#8899AA')).toBe(false);
    });
  });

  describe('rare', () => {
    it('détecte la saturation élevée', () => {
      // #B8431F : saturation ≈ 71 %, mais chroma insuffisant pour épique
      expect(isRare('#B8431F')).toBe(true);
      expect(computeRarity('#B8431F')).toBe('rare');
    });

    it('détecte la luminosité extrême', () => {
      expect(isRare('#F5F2EE')).toBe(true); // presque blanc
      expect(isRare('#0D0B08')).toBe(true); // presque noir
    });

    it('rejette les tons moyens désaturés', () => {
      expect(isRare('#7A6E5F')).toBe(false);
    });
  });

  describe('commune', () => {
    it('classe les couleurs du quotidien en commune', () => {
      expect(computeRarity('#7A6E5F')).toBe('commune'); // brun terne
      expect(computeRarity('#5C6B5D')).toBe('commune'); // vert grisé
      expect(computeRarity('#9A8F84')).toBe('commune'); // beige
    });
  });

  describe('priorité des rangs', () => {
    it('légendaire prime sur épique', () => {
      // #FF0000 est aussi une couleur pure, mais 00/FF le rend légendaire
      expect(computeRarity('#FF0000')).toBe('legendaire');
    });

    it('épique prime sur rare', () => {
      // #F51D0A est très saturé, mais la pureté le rend épique
      expect(computeRarity('#F51D0A')).toBe('epique');
    });
  });
});
