import { Model, BuildOptions } from "sequelize";

// Zone — nœud d'arbre hiérarchique (entreprise > bâtiment > étage > pièce > …)
// `parentId` null => racine. `type` est un libellé libre du niveau.

interface ZoneCreation {
  id?: string;
  name: string;
  type?: string | null;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface Zone {
  id: string;
  name: string;
  type: string | null;
  parentId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type ZoneModel = Model<Zone, ZoneCreation>;

// Static avec méthode d'association au niveau du modèle
type ZoneStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (values?: Record<string, unknown>, options?: BuildOptions): ZoneModel;
};

export type { Zone, ZoneCreation, ZoneModel, ZoneStatic };
