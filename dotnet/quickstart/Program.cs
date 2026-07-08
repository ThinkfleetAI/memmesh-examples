using MemMesh;

var mm = new MemMeshClient(
    Environment.GetEnvironmentVariable("MEMMESH_API_KEY")!,
    Environment.GetEnvironmentVariable("MEMMESH_PROJECT_ID")!);

await mm.Memory.ObserveAsync("Prefers email over phone.",
    subject: new Subject("contact", "sarah"));

foreach (var h in await mm.Memory.SearchAsync("how to reach sarah", limit: 5))
    Console.WriteLine(h.Content);

var res = await mm.Memory.ReflectAsync(maxInsights: 3);
foreach (var i in res.Insights)
    Console.WriteLine($"{i.Content} ({i.Confidence:P0})");
