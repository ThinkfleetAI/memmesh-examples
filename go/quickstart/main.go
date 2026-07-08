// Minimal MemMesh Go quickstart: observe, search, reflect.
//
//	go mod init example && go get github.com/ThinkfleetAI/memmesh-go
//	MEMMESH_API_KEY=sk-... MEMMESH_PROJECT_ID=proj_... go run .
package main

import (
	"context"
	"fmt"
	"os"

	memmesh "github.com/ThinkfleetAI/memmesh-go"
)

func main() {
	ctx := context.Background()
	mm := memmesh.New(os.Getenv("MEMMESH_API_KEY"), os.Getenv("MEMMESH_PROJECT_ID"))

	mm.Memory.Observe(ctx, memmesh.Observe{
		Subject: memmesh.Subject{Kind: "contact", ExternalID: "sarah"},
		Content: "Prefers email over phone.",
	})
	hits, _ := mm.Memory.Search(ctx, "how to reach sarah", memmesh.SearchOpts{Limit: 5})
	for _, h := range hits {
		fmt.Println(h.Content)
	}
	res, _ := mm.Memory.Reflect(ctx, memmesh.ReflectOpts{MaxInsights: 3})
	for _, in := range res.Insights {
		fmt.Printf("%s (%.0f%%)\n", in.Content, in.Confidence*100)
	}
}
