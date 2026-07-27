interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}


interface Product {
  id: string;
  title: string;
  description: string;
  category_id: number;
  specifications: Record<string,string>;
}



export default async function ProductPage({
  params,
}: ProductPageProps) {


  const { id } = await params;


  const response = await fetch(
    `http://localhost:3001/products?id=${id}`
  );


  const data: Product[] = await response.json();


  const product = data[0];


  if (!product) {
    return (
      <div>
        Товар не найден
      </div>
    );
  }



  return (

    <main>

      <h1>
        {product.title}
      </h1>


      <p>
        {product.description}
      </p>



      <h3>
        Характеристики
      </h3>


      <ul>

        {Object.entries(
          product.specifications
        ).map(([key,value]) => (

          <li key={key}>

            {key}: {value}

          </li>

        ))}

      </ul>


    </main>

  );
}