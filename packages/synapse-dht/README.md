```typescript
Client.build({
  registrations: async (ioc: DependencyContainer) => {
    const superCopAlgo = await ED25519SuperCopAlgorithm.build();
    ioc.registerInstance('ISigningAlgorithm', superCopAlgo);
    ioc.registerInstance(ED25519SuperCopAlgorithm, superCopAlgo);

    // IoC must always be returned.
    return ioc;
  }
});
```
