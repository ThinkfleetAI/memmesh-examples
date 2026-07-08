use memmesh::{MemMesh, Observe, ReflectOpts, Subject};

#[tokio::main]
async fn main() -> Result<(), memmesh::Error> {
    let mm = MemMesh::new(
        std::env::var("MEMMESH_API_KEY").unwrap(),
        std::env::var("MEMMESH_PROJECT_ID").unwrap(),
    );
    mm.memory()
        .observe(Observe {
            subject: Some(Subject::new("contact", "sarah")),
            content: "Prefers email over phone.".into(),
            ..Default::default()
        })
        .await?;
    for hit in mm.memory().search("how to reach sarah", 5).await? {
        println!("{}", hit.content);
    }
    let res = mm
        .memory()
        .reflect(ReflectOpts { max_insights: Some(3), ..Default::default() })
        .await?;
    for i in res.insights {
        println!("{} ({:.0}%)", i.content, i.confidence * 100.0);
    }
    Ok(())
}
