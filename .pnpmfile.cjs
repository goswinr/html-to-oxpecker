module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "solid-start") {
        pkg.dependencies = {
          ...pkg.dependencies,
          esbuild: "0.28.1",
          undici: "5.29.0",
          "wait-on": "9.0.10",
        };
      }

      if (pkg.name === "vite" && pkg.dependencies?.esbuild) {
        pkg.dependencies = {
          ...pkg.dependencies,
          esbuild: "0.28.1",
        };
      }

      return pkg;
    },
  },
};
