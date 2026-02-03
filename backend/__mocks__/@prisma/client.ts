const prismaMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userSettings: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  anchor: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  charge: {
    create: jest.fn(),
  },
  activation: {
    create: jest.fn(),
  },
};

class PrismaClient {
  user = prismaMock.user;
  userSettings = prismaMock.userSettings;
  anchor = prismaMock.anchor;
  charge = prismaMock.charge;
  activation = prismaMock.activation;
}

export { PrismaClient, prismaMock as __prismaMock };
